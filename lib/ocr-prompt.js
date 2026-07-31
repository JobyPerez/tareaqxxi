const fs = require('fs');
const path = require('path');
const { DEFAULT_OCR_PROMPT } = require('./ocr');

const OCR_PROMPT_FILE = path.join(__dirname, '..', '.ocr-prompt');
const MAX_OCR_PROMPT_LENGTH = 30000;

function validateOcrPrompt(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('El prompt OCR no puede estar vacío');
  }
  if (value.length > MAX_OCR_PROMPT_LENGTH) {
    throw new Error(`El prompt OCR no puede superar ${MAX_OCR_PROMPT_LENGTH} caracteres`);
  }
  return value.trim();
}

function getGlobalOcrPrompt() {
  try {
    const prompt = fs.readFileSync(OCR_PROMPT_FILE, 'utf8').trim();
    return prompt || DEFAULT_OCR_PROMPT;
  } catch (error) {
    if (error.code === 'ENOENT') return DEFAULT_OCR_PROMPT;
    throw error;
  }
}

function saveGlobalOcrPrompt(value) {
  const prompt = validateOcrPrompt(value);
  const temporaryFile = `${OCR_PROMPT_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, `${prompt}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryFile, OCR_PROMPT_FILE);
  return prompt;
}

module.exports = {
  getGlobalOcrPrompt,
  MAX_OCR_PROMPT_LENGTH,
  saveGlobalOcrPrompt,
  validateOcrPrompt
};
