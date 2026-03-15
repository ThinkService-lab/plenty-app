// ── In-memory rate limiter (resets on cold start — same pattern as api/meals.js)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;        // max requests
const RATE_WINDOW = 60_000;   // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_LENGTH = 4_000_000; // ~3MB of base64 data; guards Vercel's 4.5MB request limit

const SCAN_PROMPT = `Look at this image and identify all visible food ingredients.
For each ingredient, estimate the quantity if visible (e.g. "3 eggs", "500g chicken", "1 onion").
If quantity is not visible, omit it.
Return ONLY valid JSON, no markdown:
{"ingredients":[{"name":"egg","quantity":"3"},{"name":"onion"}]}
If you cannot identify any ingredients, return: {"ingredients":[]}`;

export default async function handler(req, res) {
  // ── CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  // ── Validate body
  const body = req.body || {};
  const { image, mimeType } = body;

  if (typeof image !== 'string' || image.length === 0) {
    return res.status(400).json({ error: 'Invalid request: image is required.' });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid request: unsupported image type.' });
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' });
  }

  // ── Call Claude Haiku vision
  // NOTE: Unlike api/meals.js which sends content as a plain string,
  // vision calls require content to be an ARRAY with an image block + text block.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: image }
            },
            { type: 'text', text: SCAN_PROMPT }
          ]
        }]
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.content && Array.isArray(data.content)) {
      const rawText = data.content.map(b => b.text || '').join('');
      // Step 1: Extract JSON by finding outermost braces (strips any surrounding prose)
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        let jsonStr = rawText.substring(start, end + 1);
        // Step 2: Clean control characters — same Vercel compilation guard as meals.js
        jsonStr = jsonStr.split('').map(c => {
          const code = c.charCodeAt(0);
          if (code === 9 || code === 10 || code === 13) return ' ';
          if (code < 32 || code === 127) return '';
          return c;
        }).join('');
        try {
          const parsed = JSON.parse(jsonStr);
          return res.status(200).json({ ingredients: parsed.ingredients || [] });
        } catch {
          return res.status(200).json({ ingredients: [] });
        }
      }
    }

    return res.status(200).json({ ingredients: [] });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    return res.status(500).json({ error: 'Scan failed. Please try manually.' });
  }
}
