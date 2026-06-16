const NOTION_DATA_SOURCE_ID = '99947b1b-a6e5-44b7-ab1e-dfc88f6fbb22';
const NOTION_UNIVERSIDAD_DATA_SOURCE_ID = 'a9378630-0623-4745-b9aa-24ba8b43065e';

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
  let universidadRelation = null;

  if (taskData.universidad) {
    universidadRelation = await searchUniversidad(notionApiKey, taskData.universidad);
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
    properties['QXXI externa'] = {
      url: taskData.qxxiUrl
    };
  }

  if (universidadRelation) {
    properties['Universidad'] = {
      relation: [{ id: universidadRelation }]
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
    const error = await response.json();
    throw new Error('Notion API error: ' + JSON.stringify(error));
  }

  return await response.json();
}

module.exports = { createTask, selectTemplate };
