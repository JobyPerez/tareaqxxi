const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const {
  createTask,
  getInstallationEnvironment,
  normalizeCorrectiveVersions,
  selectTemplate
} = require('../lib/notion');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('infers the environment only for installation tasks', () => {
  const installation = selectTemplate('Actualización de versión');
  const regular = selectTemplate('Error de datos');

  assert.equal(getInstallationEnvironment(installation, 'UXXI-INV INV-12345_RE instalación'), 'Producción');
  assert.equal(getInstallationEnvironment(installation, 'UXXI-INV INV-12345_rp instalación'), 'Pruebas');
  assert.equal(getInstallationEnvironment(installation, 'UXXI-INV INV-12345_RE instalación', 'Pruebas'), 'Pruebas');
  assert.equal(getInstallationEnvironment(installation, 'UXXI-INV INV-12345 instalación'), null);
  assert.equal(getInstallationEnvironment(regular, 'UXXI-INV INV-12345_RE instalación'), null);
  assert.equal(getInstallationEnvironment(regular, 'INV-12345', 'Producción'), null);
});

test('normalizes and deduplicates corrective versions', () => {
  assert.deepEqual(
    normalizeCorrectiveVersions('25.3.5, UXXI-INV 25.3.6 / 25.3.5'),
    ['UXXI-INV 25.3.5', 'UXXI-INV 25.3.6']
  );
  assert.deepEqual(normalizeCorrectiveVersions('INV-12345 sin versión'), []);
});

test('adds Entorno as a multi-select without changing the title', async () => {
  const nombre = 'UXXI-INV INV-12345_RE preparar instalación';
  let requestBody;

  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.notion.com/v1/pages');
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: 'page-id' })
    };
  };

  await createTask('notion-key', {
    nombre,
    tipo: 'Actualizacion de version',
    qxxiUrl: '',
    universidad: ''
  });

  assert.equal(requestBody.properties.Nombre.title[0].text.content, nombre);
  assert.deepEqual(requestBody.properties.Entorno, {
    multi_select: [{ name: 'Producción' }]
  });
});

test('omits Entorno from other task types', async () => {
  let requestBody;
  let requestCount = 0;

  global.fetch = async (_url, options) => {
    requestCount += 1;
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: 'page-id' })
    };
  };

  await createTask('notion-key', {
    nombre: 'INV-12345_RP corregir datos',
    tipo: 'Error de datos',
    qxxiUrl: '',
    universidad: '',
    versionesCorrectoras: '25.3.5'
  });

  assert.equal(Object.hasOwn(requestBody.properties, 'Entorno'), false);
  assert.equal(Object.hasOwn(requestBody.properties, 'Versión'), false);
  assert.equal(requestCount, 1);
});

test('relates existing versions and creates missing versions for installation tasks', async () => {
  const versionSearches = [];
  let createdVersionBody;
  let taskBody;

  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);

    if (url.includes('/databases/')) {
      const versionName = body.filter.title.equals;
      versionSearches.push(versionName);
      return {
        ok: true,
        json: async () => ({
          results: versionName === 'UXXI-INV 25.3.5' ? [{ id: 'existing-version-id' }] : []
        })
      };
    }

    if (body.parent.database_id) {
      createdVersionBody = body;
      return {
        ok: true,
        json: async () => ({ id: 'created-version-id' })
      };
    }

    taskBody = body;
    return {
      ok: true,
      json: async () => ({ id: 'task-page-id' })
    };
  };

  await createTask('notion-key', {
    nombre: 'UXXI-INV INV-12345_RE preparar instalación',
    tipo: 'Actualización de versión',
    qxxiUrl: '',
    universidad: '',
    versionesCorrectoras: '25.3.5, 25.3.6'
  });

  assert.deepEqual(versionSearches, ['UXXI-INV 25.3.5', 'UXXI-INV 25.3.6']);
  assert.equal(createdVersionBody.properties.Name.title[0].text.content, 'UXXI-INV 25.3.6');
  assert.deepEqual(taskBody.properties['Versión'], {
    relation: [{ id: 'existing-version-id' }, { id: 'created-version-id' }]
  });
});

test('requires an environment for installation tasks without a recognized suffix', async () => {
  await assert.rejects(
    createTask('notion-key', {
      nombre: 'UXXI-INV INV-12345 preparar instalación',
      tipo: 'Actualización de versión',
      qxxiUrl: '',
      universidad: '',
      entorno: ''
    }),
    /Selecciona un entorno válido/
  );
});

test('reports a clear error when Notion returns an HTML outage page', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 522,
    headers: new Headers({ 'content-type': 'text/html' }),
    text: async () => '<!DOCTYPE html><title>Notion</title>'
  });

  await assert.rejects(
    createTask('notion-key', {
      nombre: 'INV-12345 corregir datos',
      tipo: 'Error de datos',
      qxxiUrl: '',
      universidad: ''
    }),
    /Notion no está disponible temporalmente \(HTTP 522\)/
  );
});
