const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { extractFromScreenshot } = require('../lib/ocr');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('uses the OCR title content after the first slash', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"nombre":"UXXI-INV / INV-12345_RE título"}' } }]
    })
  });

  const result = await extractFromScreenshot('api-key', 'image', 'mimo-v2.5');

  assert.equal(result.nombre, 'INV-12345_RE título');
});

test('keeps an OCR title that has no slash', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"nombre":"IINV-12345 título"}' } }]
    })
  });

  const result = await extractFromScreenshot('api-key', 'image', 'mimo-v2.5');

  assert.equal(result.nombre, 'IINV-12345 título');
});

test('sends a custom prompt to the OCR model', async () => {
  let requestBody;
  global.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"nombre":"INV-1"}' } }] })
    };
  };

  await extractFromScreenshot('api-key', 'image', 'mimo-v2.5', 'Prompt personalizado');

  assert.equal(requestBody.messages[0].content[1].text, 'Prompt personalizado');
});
