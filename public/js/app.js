const pasteZone = document.getElementById('paste-zone');
const previewSection = document.getElementById('preview-section');
const previewImg = document.getElementById('preview-img');
const loadingSection = document.getElementById('loading-section');
const formSection = document.getElementById('form-section');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const taskForm = document.getElementById('task-form');
const clearBtn = document.getElementById('clear-btn');
const submitBtn = document.getElementById('submit-btn');
const retryBtn = document.getElementById('retry-btn');
const errorText = document.getElementById('error-text');
const notionLink = document.getElementById('notion-link');

let currentImageBase64 = null;

document.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      handleImage(blob);
      return;
    }
  }
});

pasteZone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    if (e.target.files[0]) {
      handleImage(e.target.files[0]);
    }
  };
  input.click();
});

pasteZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  pasteZone.classList.add('active');
});

pasteZone.addEventListener('dragleave', () => {
  pasteZone.classList.remove('active');
});

pasteZone.addEventListener('drop', (e) => {
  e.preventDefault();
  pasteZone.classList.remove('active');
  if (e.dataTransfer.files[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
    handleImage(e.dataTransfer.files[0]);
  }
});

function handleImage(blob) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    previewImg.src = dataUrl;
    currentImageBase64 = dataUrl.split(',')[1];

    pasteZone.style.display = 'none';
    previewSection.style.display = 'block';
    formSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';

    processImage();
  };
  reader.readAsDataURL(blob);
}

async function processImage() {
  previewSection.style.display = 'block';
  loadingSection.style.display = 'block';
  formSection.style.display = 'none';
  resultSection.style.display = 'none';
  errorSection.style.display = 'none';

  try {
    const response = await fetch('/tareaqxxi/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: currentImageBase64 })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error en OCR');
    }

    const data = await response.json();
    showForm(data);
  } catch (error) {
    showError(error.message);
  }
}

function showForm(data) {
  loadingSection.style.display = 'none';
  formSection.style.display = 'block';

  document.getElementById('nombre').value = data.nombre || '';
  document.getElementById('qxxiUrl').value = data.qxxiUrl || '';
  document.getElementById('tipo').value = data.tipo || '';
  document.getElementById('universidad').value = data.universidad || '';
  updateTemplateHint();
}

function updateTemplateHint() {
  const tipo = document.getElementById('tipo').value.toLowerCase();
  const hint = document.getElementById('template-hint');
  if (tipo.includes('actualización de versión') || tipo.includes('actualizacion de version')) {
    hint.textContent = 'Plantilla: Petición de instalación: pasos para la preparación y validación';
  } else {
    hint.textContent = 'Plantilla: Entrada QuaterniXXI petición/error de datos';
  }
}

document.getElementById('tipo').addEventListener('input', updateTemplateHint);

function showError(message) {
  loadingSection.style.display = 'none';
  errorSection.style.display = 'block';
  errorText.textContent = message;
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creando...';

  const taskData = {
    nombre: document.getElementById('nombre').value,
    qxxiUrl: document.getElementById('qxxiUrl').value,
    tipo: document.getElementById('tipo').value,
    universidad: document.getElementById('universidad').value
  };

  try {
    const response = await fetch('/tareaqxxi/api/create-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error al crear tarea');
    }

    const result = await response.json();
    formSection.style.display = 'none';
    previewSection.style.display = 'none';
    resultSection.style.display = 'block';

    if (result.page && result.page.url) {
      notionLink.href = result.page.url;
    }
  } catch (error) {
    showError(error.message);
    formSection.style.display = 'none';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crear tarea en Notion';
  }
});

clearBtn.addEventListener('click', resetApp);
retryBtn.addEventListener('click', () => {
  errorSection.style.display = 'none';
  processImage();
});
document.getElementById('new-task-btn').addEventListener('click', resetApp);

function resetApp() {
  currentImageBase64 = null;
  previewImg.src = '';
  pasteZone.style.display = 'block';
  previewSection.style.display = 'none';
  loadingSection.style.display = 'none';
  formSection.style.display = 'none';
  resultSection.style.display = 'none';
  errorSection.style.display = 'none';
}
