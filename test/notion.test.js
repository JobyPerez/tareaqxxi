const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const {
  createTask,
  getInstallationEnvironment,
  getMadridNowForNotion,
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

    if (body.parent.database_id === '291d9277-e2b6-42d1-8a05-002087f4dc89') {
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

test('sets Fecha realización immediately so day/hour do not depend on the async template job', async () => {
  let requestBody;
  let requestHeaders;

  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    requestHeaders = options.headers;
    return {
      ok: true,
      json: async () => ({ id: 'page-id' })
    };
  };

  await createTask('notion-key', {
    nombre: 'INV-12345 corregir datos',
    tipo: 'Error de datos',
    qxxiUrl: '',
    universidad: ''
  });

  const start = requestBody.properties['Fecha realización']?.date?.start;
  assert.match(start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  assert.equal(requestHeaders['Notion-Version'], '2022-06-28');
  assert.equal(requestBody.parent.database_id, '16bce85f-6aef-4da5-ad2c-a03a4e9e2c6e');
  assert.equal(requestBody.template.template_id, '9ec447de-d54e-4f5d-b6e9-c89ed957b900');
});

test('formats Madrid now with the correct DST offset', () => {
  const summer = getMadridNowForNotion(new Date('2026-09-17T11:00:00.000Z'));
  const winter = getMadridNowForNotion(new Date('2026-01-17T11:00:00.000Z'));
  assert.ok(summer.startsWith('2026-09-17T13:00:00.000+02:00'), summer);
  assert.ok(winter.startsWith('2026-01-17T12:00:00.000+01:00'), winter);
});
