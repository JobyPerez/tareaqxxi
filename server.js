require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { extractFromScreenshot } = require('./lib/ocr');
const { createTask } = require('./lib/notion');

const app = express();
const PORT = process.env.PORT || 3012;

function getOcrModels() {
  const modelsStr = process.env.OCR_MODEL || 'mimo-v2.5';
  const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean);
  return models.length > 0 ? models : ['mimo-v2.5'];
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/tareaqxxi', express.static(path.join(__dirname, 'public')));

app.get('/tareaqxxi/', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/tareaqxxi/app');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/tareaqxxi/');
}

app.post('/tareaqxxi/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.APP_USER && password === process.env.APP_PASS) {
    req.session.authenticated = true;
    return res.redirect('/tareaqxxi/app');
  }
  res.redirect('/tareaqxxi/?error=1');
});

app.get('/tareaqxxi/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/tareaqxxi/');
});

app.get('/tareaqxxi/app', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/tareaqxxi/api/config', requireAuth, (req, res) => {
  res.json({
    ocrModels: getOcrModels()
  });
});

app.post('/tareaqxxi/api/ocr', requireAuth, async (req, res) => {
  try {
    const { image, model } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No se recibió imagen' });
    }
    const models = getOcrModels();
    const selectedModel = models.includes(model) ? model : models[0];

    const result = await extractFromScreenshot(process.env.OPENCODE_GO_API_KEY, image, selectedModel);
    res.json(result);
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/tareaqxxi/api/create-task', requireAuth, async (req, res) => {
  try {
    const taskData = req.body;
    const result = await createTask(process.env.NOTION_API_KEY, taskData);
    res.json({ success: true, page: result });
  } catch (error) {
    console.error('Notion error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`tareaqxxi running on port ${PORT}`);
});
