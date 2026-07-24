const NOTION_DATA_SOURCE_ID = '99947b1b-a6e5-44b7-ab1e-dfc88f6fbb22';
const NOTION_UNIVERSIDAD_DATA_SOURCE_ID = 'a9378630-0623-4745-b9aa-24ba8b43065e';
const NOTION_VERSION_DATABASE_ID = '291d9277-e2b6-42d1-8a05-002087f4dc89';

const TEMPLATES = {
  default: {
    name: 'Entrada QuaterniXXI petición/error de datos',
    id: '9ec447de-d54e-4f5d-b6e9-c89ed957b900'
  },
  instalacion: {
    name: 'Petición de instalación: pasos para la preparación y validación',
    id: 'c0097256-5d37-4b1b-9265-706ec06f2736'
  }
};

function selectTemplate(tipo) {
  if (!tipo) return TEMPLATES.default;
  const lower = tipo.toLowerCase();
  if (lower.includes('actualización de versión') || lower.includes('actualizacion de version')) {
    return TEMPLATES.instalacion;
  }
  return TEMPLATES.default;
}

function isInternalQxxiTask(taskData) {
  return /IINV-\d+/i.test(`${taskData.qxxiUrl || ''} ${taskData.nombre || ''}`);
}

function getInstallationEnvironment(template, nombre, entorno) {
  if (template !== TEMPLATES.instalacion) return null;

  if (entorno === 'Producción' || entorno === 'Pruebas') return entorno;
  if (!nombre) return null;

  const match = nombre.match(/_R(E|P)(?=\W|_|$)/i);
  if (!match) return null;

  return match[1].toUpperCase() === 'E' ? 'Producción' : 'Pruebas';
}

function normalizeCorrectiveVersions(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value || '');
  const versions = text.match(/\b\d+(?:\.\d+)+\b/g) || [];
  return [...new Set(versions.map(version => `UXXI-INV ${version}`))];
}

async function throwNotionApiError(response) {
  if (response.status >= 500) {
    throw new Error(`Notion no está disponible temporalmente (HTTP ${response.status}). Inténtalo de nuevo.`);
  }

  const contentType = response.headers && response.headers.get('content-type');
  const error = contentType && contentType.includes('application/json')
    ? JSON.stringify(await response.json())
    : await response.text();
  throw new Error('Notion API error: ' + error);
}

async function findOrCreateVersion(notionApiKey, name) {
  const headers = {
    'Authorization': 'Bearer ' + notionApiKey,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };
  const searchResponse = await fetch('https://api.notion.com/v1/databases/' + NOTION_VERSION_DATABASE_ID + '/query', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      page_size: 1,
      filter: {
        property: 'Name',
        title: { equals: name }
      }
    })
  });

  if (!searchResponse.ok) await throwNotionApiError(searchResponse);

  const searchData = await searchResponse.json();
  if (searchData.results && searchData.results.length > 0) {
    return searchData.results[0].id;
  }

  const createResponse = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: NOTION_VERSION_DATABASE_ID },
      properties: {
        'Name': {
          title: [{ text: { content: name } }]
        }
      }
    })
  });

  if (!createResponse.ok) await throwNotionApiError(createResponse);

  const createdPage = await createResponse.json();
  return createdPage.id;
}

async function searchUniversidad(notionApiKey, acronimo) {
  if (!acronimo) return null;

  const response = await fetch('https://api.notion.com/v1/databases/' + NOTION_UNIVERSIDAD_DATA_SOURCE_ID + '/query', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + notionApiKey,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      filter: {
        property: 'title',
        title: { equals: acronimo }
      }
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.results && data.results.length > 0) {
    return data.results[0].id;
  }
  return null;
}

async function createTask(notionApiKey, taskData) {
  const template = selectTemplate(taskData.tipo);
  const environment = getInstallationEnvironment(template, taskData.nombre, taskData.entorno);
  const versionNames = template === TEMPLATES.instalacion
    ? normalizeCorrectiveVersions(taskData.versionesCorrectoras)
    : [];
  let universidadRelation = null;
  const versionRelations = [];

  if (template === TEMPLATES.instalacion && !environment) {
    throw new Error('Selecciona un entorno válido para la petición de instalación');
  }

  if (taskData.universidad) {
    universidadRelation = await searchUniversidad(notionApiKey, taskData.universidad);
  }

  for (const versionName of versionNames) {
    versionRelations.push({ id: await findOrCreateVersion(notionApiKey, versionName) });
  }

  const properties = {
    'Nombre': {
      title: [{ text: { content: taskData.nombre } }]
    },
    'Estado': {
      status: { name: 'En curso' }
    },
    'Prioridad': {
      select: { name: 'Es necesario hacerlo hoy' }
    }
  };

  if (taskData.qxxiUrl) {
    const qxxiUrlProperty = isInternalQxxiTask(taskData) ? 'QXXI interna' : 'QXXI externa';
    properties[qxxiUrlProperty] = {
      url: taskData.qxxiUrl
    };
  }

  if (universidadRelation) {
    properties['Universidad'] = {
      relation: [{ id: universidadRelation }]
    };
  }

  if (environment) {
    properties['Entorno'] = {
      multi_select: [{ name: environment }]
    };
  }

  if (versionRelations.length > 0) {
    properties['Versión'] = {
      relation: versionRelations
    };
  }

  const payload = {
    parent: {
      type: 'data_source_id',
      data_source_id: NOTION_DATA_SOURCE_ID
    },
    properties: properties,
    template: {
      type: 'template_id',
      template_id: template.id,
      timezone: 'Europe/Madrid'
    }
  };

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + notionApiKey,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    await throwNotionApiError(response);
  }

  return await response.json();
}

module.exports = {
  createTask,
  findOrCreateVersion,
  getInstallationEnvironment,
  isInternalQxxiTask,
  normalizeCorrectiveVersions,
  selectTemplate
};
