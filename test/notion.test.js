const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const {
  createTask,
  getInstallationEnvironment,
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

  global.fetch = async (_url, options) => {
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
    universidad: ''
  });

  assert.equal(Object.hasOwn(requestBody.properties, 'Entorno'), false);
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
