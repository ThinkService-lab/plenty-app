import { checkAndIncrementUsage } from './usage.js';
import { getAppCheck } from 'firebase-admin/app-check';

// ── In-memory rate limiter (resets on cold start, good enough for serverless)
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

// ── Input sanitization
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[^\w\s,.()\-:éèêëàâùûüïîôœç°%\/\[\]{}"|'!?_#@]/gi, '') // allow safe chars + JSON schema chars
    .slice(0, maxLen)
    .trim();
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  if (messages.length > 10) return null; // no excessive history

  return messages.map(msg => {
    if (typeof msg !== 'object' || !msg) return null;
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = sanitizeString(
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      4000 // max prompt length
    );
    return { role, content };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  // ── CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── App Check verification
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (!appCheckToken) {
    return res.status(401).json({ error: 'Unauthorized request.' });
  }
  try {
    await getAppCheck().verifyToken(appCheckToken);
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized request.' });
  }

  // ── Rate limiting
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  // ── Usage check (authenticated requests only)
  // Anonymous requests (no Authorization header) pass through — client enforces the 2-try anon limit.
  const authHeader = req.headers['authorization'];
  let usageData = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (!token) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    const usageResult = await checkAndIncrementUsage(token);

    if (usageResult.error === 'unauthorized') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (usageResult.error === 'service_unavailable') {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
    if (usageResult.error === 'limit_reached') {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      ));
      return res.status(429).json({
        error: 'limit_reached',
        resets_at: tomorrow.toISOString()
      });
    }
    usageData = { count: usageResult.count, limit: usageResult.limit };
  }

  // ── Validate & sanitize body
  const body = req.body || {};

  const messages = sanitizeMessages(body.messages);
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const maxTokens = Math.min(Math.max(parseInt(body.max_tokens) || 1800, 100), 2000);

  // ── Call Anthropic
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
        max_tokens: maxTokens,
        messages
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.content && Array.isArray(data.content)) {
      const rawText = data.content.map(b => b.text || '').join('');
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        let jsonStr = rawText.substring(start, end + 1);
        // Clean control characters
        jsonStr = jsonStr.split('').map(c => {
          const code = c.charCodeAt(0);
          if (code === 9 || code === 10 || code === 13) return ' ';
          if (code < 32 || code === 127) return '';
          return c;
        }).join('');
        // Strip trailing commas before closing brackets/braces (Claude occasionally emits these)
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        try {
          const parsed = JSON.parse(jsonStr);
          return res.status(200).json({ clean: true, parsed, usage: usageData });
        } catch (parseErr) {
          return res.status(200).json({ clean: false, raw: jsonStr, usage: usageData });
        }
      }
    }

    res.status(response.status).json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}