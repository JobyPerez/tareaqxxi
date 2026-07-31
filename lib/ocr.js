const OPENCODE_ZEN_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
const OPENCODE_GO_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';

const DEFAULT_OCR_PROMPT = `Analiza esta captura de pantalla de QXXI (QuaterniXXI) y extrae la siguiente información en formato JSON:

1. "nombre": El texto que aparece después de la primera barra "/" del título. Debe empezar por "INV-" o "IINV-", nunca por "UXXI-INV". Conserva todo ese texto, incluidos sufijos como "_RE" o "_RP"
2. "qxxiUrl": La URL del navegador que empieza con "https://qxxi.universitasxxi.com/browse/"
3. "tipo": El valor del campo "Tipo" o "Tipo de solicitud" si es visible
4. "universidad": El acrónimo de la universidad, inferido del campo "Cliente" o "Entorno" si es visible
5. "versionesCorrectoras": Todos los valores del campo "Versión(es) Correctora(s)", separados por comas si hay más de uno

Devuelve SOLO un objeto JSON válido sin texto adicional, con esta estructura exacta:
{
  "nombre": "INV-XXXXX_RE título completo de la entrada",
  "qxxiUrl": "https://qxxi.universitasxxi.com/browse/...",
  "tipo": "valor del tipo",
  "universidad": "ACRONIMO",
  "versionesCorrectoras": "25.3.5, 25.3.6"
}

Si algún campo no es visible o no se puede extraer, déjalo como string vacío "".

No expliques tu razonamiento. No uses Markdown. Responde únicamente con el objeto JSON.`;

async function extractFromScreenshot(apiKey, imageBase64, modelName, prompt) {
  const model = modelName || 'mimo-v2.5';
  const isFreeModel = model.endsWith('-free');
  const endpoint = isFreeModel ? OPENCODE_ZEN_ENDPOINT : OPENCODE_GO_ENDPOINT;
  const mediaType = imageBase64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;

  const payload = {
    model,
    max_tokens: isFreeModel ? 4096 : 1024,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: dataUrl
            }
          },
          {
            type: 'text',
            text: prompt || DEFAULT_OCR_PROMPT
          }
        ]
      }
    ]
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('OpenCode API error: ' + error);
  }

  const data = await response.json();
  const message = data.choices[0].message;
  const content = message.content || message.reasoning || '';

  if (!content) {
    throw new Error('El modelo no devolvió contenido');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta del modelo');
  }

  const result = JSON.parse(jsonMatch[0]);
  if (typeof result.nombre === 'string' && result.nombre.includes('/')) {
    result.nombre = result.nombre.slice(result.nombre.indexOf('/') + 1).trim();
  }

  return result;
}

module.exports = { DEFAULT_OCR_PROMPT, extractFromScreenshot };
