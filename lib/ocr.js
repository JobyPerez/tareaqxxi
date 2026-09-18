const crypto = require('crypto');

const OPENCODE_ZEN_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
const OPENCODE_ZEN_GENERATE_BASE = 'https://opencode.ai/zen/v1/models';
const OPENCODE_GO_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';

const DEFAULT_OCR_PROMPT = `Analiza esta captura de pantalla de QXXI (QuaterniXXI) y extrae la siguiente información en formato JSON:

1. "nombre": El texto desde "INV-" o "IINV-" del título (quita el prefijo "UXXI-INV /" si aparece). Debe empezar por "INV-" o "IINV-", nunca por "UXXI-INV". Conserva todo ese texto, incluidos sufijos como "_RE" o "_RP" y la línea de abajo, que también es el título. Si el resto del título contiene otras barras "/" (por ejemplo "2025/000001686"), consérvalas tal cual.
2. "qxxiUrl": La URL del navegador que empieza con "https://qxxi.universitasxxi.com/browse/"
3. "tipo": El valor del campo "Tipo" o "Tipo de solicitud" si es visible
4. "universidad": El acrónimo de la universidad, inferido del campo "Cliente" o "Entorno" si es visible. Si el Cliente es UXXI, esto no es válido; hay que intentarlo en el campo Entorno. Quita RE, RP o RT si sale en el campo Entorno.
5. "versionesCorrectoras": La versión correctora de la entrada. En el panel de detalles hay una sección "Versión" o "Versión correctora" (a veces se ve como título desplegable "▼ Versión"); su valor (por ejemplo "26.2.9") suele aparecer debajo del título, en la línea siguiente, no después de los dos puntos. No lo confundas con el campo "Resolución", cuyo valor suele ser "Sin resolver", ni con "Nivel de Seguridad". Si además se ve un campo "Versión(es) Correctora(s)", incluye también sus valores. Separa por comas si hay más de uno

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

function sanitizeNombre(nombre) {
  if (typeof nombre !== 'string') return nombre;
  const trimmed = nombre.trim();
  // El título de QXXI es "UXXI-INV / INV-12345 ...". El modelo ya debería
  // devolver desde "INV-...", pero por seguridad quitamos el prefijo.
  // Antes se cortaba por la primera "/" sin más, lo que rompía títulos que
  // contienen "/" (p. ej. "INV-27530 ... 2025/000001686" -> "000001686").
  // Ahora solo recortamos hasta el primer "INV-NNNN" o "IINV-NNNN"; si el
  // nombre ya empieza por ahí (o no contiene ese patrón), se conserva tal
  // cual, incluidas las barras internas.
  const match = trimmed.match(/\bI?INV-\d+/);
  if (match && match.index > 0) {
    return trimmed.slice(match.index).trim();
  }
  return trimmed;
}

function isFreeModel(model) {
  return model.endsWith('-free');
}

function isGeminiModel(model) {
  return model.startsWith('gemini-');
}

function getProviderForModel(model) {
  if (isFreeModel(model) || isGeminiModel(model)) {
    return 'Zen';
  }
  return 'Go';
}

async function extractFromScreenshot(apiKey, imageBase64, modelName, prompt) {
  const model = modelName || 'mimo-v2.5';
  const provider = getProviderForModel(model);
  const mediaType = imageBase64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;

  let endpoint;
  let payload;

  if (provider === 'Zen' && isGeminiModel(model)) {
    endpoint = `${OPENCODE_ZEN_GENERATE_BASE}/${encodeURIComponent(model)}:generateContent`;
    payload = {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: mediaType, data: imageBase64 } },
          { text: prompt || DEFAULT_OCR_PROMPT }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    };
  } else {
    endpoint = provider === 'Zen' ? OPENCODE_ZEN_ENDPOINT : OPENCODE_GO_ENDPOINT;
    payload = {
      model,
      max_tokens: isFreeModel(model) ? 4096 : 1024,
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
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-opencode-session': 'tareaqxxi-' + crypto.randomUUID()
  };
  if (provider === 'Zen' && isGeminiModel(model)) {
    headers['x-goog-api-key'] = apiKey;
  } else {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('OpenCode API error: ' + error);
  }

  const data = await response.json();
  let content;
  if (provider === 'Zen' && isGeminiModel(model)) {
    const parts = data.candidates?.[0]?.content?.parts || [];
    content = parts.map(p => p.text).filter(Boolean).join('');
  } else {
    const message = data.choices[0].message;
    content = message.content || message.reasoning || '';
  }

  if (!content) {
    throw new Error('El modelo no devolvió contenido');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta del modelo');
  }

  const result = JSON.parse(jsonMatch[0]);
  result.nombre = sanitizeNombre(result.nombre);

  return result;
}

module.exports = { DEFAULT_OCR_PROMPT, extractFromScreenshot, getProviderForModel, sanitizeNombre };
