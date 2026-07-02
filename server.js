require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { extractFromScreenshot } = require('./lib/ocr');
const { createTask } = require('./lib/notion');
const {
  resolveAppInfo,
  resolveAppVersion,
  resolveCommitsSince,
  resolveCurrentCommitHash,
  resolveCurrentShortCommitHash
} = require('./lib/version');

const app = express();
const PORT = process.env.PORT || 3012;
const VERSION_SCRIPT_ID = 'app-version-globals';

function getOcrModels() {
  const modelsStr = process.env.OCR_MODEL || 'mimo-v2.5';
  const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean);
  return models.length > 0 ? models : ['mimo-v2.5'];
}

function escapeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function buildVersionGlobalsScript() {
  const info = resolveAppInfo();
  const payload = {
    __APP_BRANCH__: info.branch,
    __APP_BUILD_TIME__: info.buildTime,
    __APP_COMMIT_HASH__: info.commitHash,
    __APP_RECENT_COMMITS__: info.recentCommits,
    __APP_SHORT_COMMIT_HASH__: info.shortCommitHash,
    __APP_VERSION__: info.version
  };

  return `<script id="${VERSION_SCRIPT_ID}">Object.assign(window, ${escapeJsonForScript(payload)});</script>`;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/tareaqxxi', express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(html?|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.get('/tareaqxxi/', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/tareaqxxi/app');
  }
  const html = require('fs').readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const injected = html.replace('</head>', `${buildVersionGlobalsScript()}\n</head>`);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(injected);
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
  const html = require('fs').readFileSync(path.join(__dirname, 'public', 'app.html'), 'utf8');
  const injected = html.replace('</head>', `${buildVersionGlobalsScript()}\n</head>`);
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(injected);
});

app.get('/tareaqxxi/api/app-info', requireAuth, (req, res) => {
  res.json(resolveAppInfo());
});

app.get('/tareaqxxi/api/app-version', requireAuth, (req, res) => {
  const currentCommit = resolveCurrentCommitHash();
  const currentShortCommit = resolveCurrentShortCommitHash();
  const { commits, rangeFound } = resolveCommitsSince(req.query.fromCommit, currentCommit);
  const fromCommit = typeof req.query.fromCommit === 'string' ? req.query.fromCommit : '';

  res.json({
    commits,
    currentCommit,
    currentShortCommit,
    currentVersion: resolveAppVersion(),
    hasUpdate: Boolean(fromCommit && currentCommit && fromCommit !== currentCommit),
    rangeFound
  });
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
