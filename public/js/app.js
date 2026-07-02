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
const modelSelect = document.getElementById('model-select');

let currentImageBase64 = null;

// Cargar configuración inicial
fetch('/tareaqxxi/api/config')
  .then(res => res.json())
  .then(data => {
    if (data.ocrModels && data.ocrModels.length > 0) {
      modelSelect.innerHTML = ''; // Clear default
      data.ocrModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });
    }
  })
  .catch(err => console.error('Error cargando config:', err));

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
      body: JSON.stringify({ 
        image: currentImageBase64,
        model: modelSelect.value
      })
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

// === Version banner and update gate =======================================

const APP_VERSION = typeof window.__APP_VERSION__ === 'string' ? window.__APP_VERSION__ : '0.0.0';
const APP_BRANCH = typeof window.__APP_BRANCH__ === 'string' ? window.__APP_BRANCH__ : '';
const APP_BUILD_TIME = typeof window.__APP_BUILD_TIME__ === 'string' ? window.__APP_BUILD_TIME__ : '';
const APP_COMMIT_HASH = typeof window.__APP_COMMIT_HASH__ === 'string' ? window.__APP_COMMIT_HASH__ : '';
const APP_RECENT_COMMITS = Array.isArray(window.__APP_RECENT_COMMITS__) ? window.__APP_RECENT_COMMITS__ : [];

const madridDateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Madrid',
  year: 'numeric'
});

function formatMadridDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return madridDateTimeFormatter.format(date);
}

function renderCommitList(target, commits, showMeta) {
  if (showMeta === undefined) {
    showMeta = true;
  }
  target.innerHTML = '';
  commits.forEach((commit) => {
    const li = document.createElement('li');
    li.className = 'commit-list-item';

    const subject = document.createElement('span');
    subject.className = 'commit-subject';
    subject.textContent = commit.subject || '';
    subject.title = commit.subject || '';
    li.appendChild(subject);

    if (showMeta) {
      const meta = document.createElement('span');
      meta.className = 'commit-meta';
      const parts = [];
      if (commit.authorName) {
        parts.push(commit.authorName);
      }
      if (commit.shortHash) {
        parts.push(commit.shortHash);
      }
      if (commit.authoredAt) {
        parts.push(formatMadridDateTime(commit.authoredAt));
      }
      meta.textContent = parts.join(' \u00b7 ');
      li.appendChild(meta);
    }

    target.appendChild(li);
  });
}

function initVersionActivity() {
  const activity = document.getElementById('version-activity');
  const button = document.getElementById('app-version-btn');
  const buildTime = document.getElementById('app-version-build-time');
  const panel = document.getElementById('version-activity-panel');
  const branchLabel = document.getElementById('version-activity-branch');
  const commitList = document.getElementById('version-commit-list');
  const commitEmpty = document.getElementById('version-commit-empty');

  if (!activity || !button || !panel || !commitList || !commitEmpty) {
    return;
  }

  const versionLabel = 'v' + APP_VERSION;
  const branchLabelText = APP_BRANCH && APP_BRANCH !== 'main' && APP_BRANCH !== 'master' ? APP_BRANCH : '';
  const buildTimeText = formatMadridDateTime(APP_BUILD_TIME);

  button.textContent = versionLabel;
  button.setAttribute('aria-label', 'Ver actividad de ' + versionLabel);
  button.title = branchLabelText
    ? 'Ver actividad de ' + versionLabel + ' en ' + branchLabelText
    : 'Ver actividad de ' + versionLabel;

  if (buildTime) {
    buildTime.textContent = 'Build: ' + buildTimeText;
  } else {
    buildTime.textContent = '';
  }

  if (branchLabelText) {
    branchLabel.textContent = 'Rama ' + branchLabelText;
    branchLabel.hidden = false;
  } else {
    branchLabel.hidden = true;
  }

  if (APP_RECENT_COMMITS.length > 0) {
    commitEmpty.hidden = true;
    renderCommitList(commitList, APP_RECENT_COMMITS);
  } else {
    commitEmpty.hidden = false;
    commitList.innerHTML = '';
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function handlePointerDown(event) {
    if (activity.contains(event.target)) {
      return;
    }
    setOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('keydown', handleKeyDown);
}

function initAppUpdateGate() {
  const banner = document.getElementById('app-update-banner');
  const bannerTitle = document.getElementById('app-update-banner-title');
  const bannerCopy = document.getElementById('app-update-banner-copy');
  const button = document.getElementById('app-update-button');
  const dismiss = document.getElementById('app-update-dismiss');
  const errorBanner = document.getElementById('app-update-banner-error');
  const errorCopy = document.getElementById('app-update-banner-error-copy');
  const errorButton = document.getElementById('app-update-error-button');
  const errorDismiss = errorBanner ? errorBanner.querySelector('[data-dismiss="error"]') : null;

  if (!banner || !button) {
    return;
  }

  let isUpdating = false;
  let serverInfo = null;
  let currentCommitHash = APP_COMMIT_HASH;
  let dismissed = false;
  let errorDismissed = false;

  function reloadPage() {
    if (isUpdating) {
      return;
    }
    isUpdating = true;
    button.textContent = 'Recargando...';
    if (errorButton) {
      errorButton.textContent = 'Recargando...';
    }
    window.location.reload();
  }

  function hideUpdateBanner() {
    banner.hidden = true;
  }

  function showUpdateBanner(info) {
    if (dismissed) {
      return;
    }
    if (bannerTitle) {
      bannerTitle.textContent = 'Nueva versión disponible';
    }
    if (bannerCopy) {
      const currentLabel = currentCommitHash ? 'v' + (serverInfo ? serverInfo.version : APP_VERSION) : 'tu versión actual';
      const nextLabel = info && info.currentVersion ? 'v' + info.currentVersion : 'la nueva versión';
      bannerCopy.textContent = 'Tu ' + currentLabel + ' está desfasada respecto a ' + nextLabel + '. Recarga para obtener los últimos cambios.';
    }
    if (button) {
      button.textContent = 'Actualizar';
    }
    banner.hidden = false;
  }

  function hideErrorBanner() {
    if (errorBanner) {
      errorBanner.hidden = true;
    }
  }

  function showErrorBanner(message) {
    if (errorDismissed || !errorBanner) {
      return;
    }
    if (errorCopy) {
      errorCopy.textContent = message || 'No se pudo comprobar la versión en el servidor. Inténtalo de nuevo en unos minutos.';
    }
    if (errorButton) {
      errorButton.textContent = 'Reintentar';
    }
    errorBanner.hidden = false;
  }

  function applyVersionInfo(info) {
    serverInfo = info;
    if (info && typeof info.commitHash === 'string') {
      currentCommitHash = info.commitHash;
    }
    if (!APP_COMMIT_HASH) {
      hideUpdateBanner();
      return;
    }
    if (info && info.commitHash && info.commitHash !== APP_COMMIT_HASH) {
      showUpdateBanner(info);
    } else {
      hideUpdateBanner();
    }
  }

  async function loadAppInfo() {
    try {
      const response = await fetch('/tareaqxxi/api/app-info', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      const info = await response.json();
      hideErrorBanner();
      applyVersionInfo(info);
    } catch (error) {
      const message = error && error.message ? error.message : '';
      if (/401|403|HTTP 30[12]/.test(message)) {
        hideErrorBanner();
        return;
      }
      showErrorBanner(message);
    }
  }

  button.addEventListener('click', reloadPage);
  if (errorButton) {
    errorButton.addEventListener('click', loadAppInfo);
  }
  if (dismiss) {
    dismiss.addEventListener('click', () => {
      dismissed = true;
      hideUpdateBanner();
    });
  }
  if (errorDismiss) {
    errorDismiss.addEventListener('click', () => {
      errorDismissed = true;
      hideErrorBanner();
    });
  }

  loadAppInfo();
  setInterval(loadAppInfo, 5 * 60 * 1000);
}

initVersionActivity();
initAppUpdateGate();
