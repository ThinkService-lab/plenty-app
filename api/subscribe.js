// ── In-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT = 5;         // max signups
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

// ── Strict email validation
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(trimmed);
}

// ── Sanitize source string
function sanitizeSource(str) {
  if (typeof str !== 'string') return 'Plenty App';
  return str.replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, 50) || 'Plenty App';
}

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwd-xuLj8t3mQABSLZ8m5pe9arxOKr6qRkTLkbDnyS-0UCuhqia-fFRC8FgZLKeV25a/exec';

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
    return res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  }

  // ── Validate inputs
  const { email, source } = req.body || {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  const safeEmail = email.trim().toLowerCase();
  const safeSource = sanitizeSource(source);

  // ── Forward to Google Sheets
  try {
    const params = new URLSearchParams({ email: safeEmail, source: safeSource });
    await fetch(SHEETS_URL + '?' + params.toString(), {
      method: 'GET',
      redirect: 'follow'
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Sheet error:', err.message);
    return res.status(500).json({ success: false, error: 'Could not save your email. Please try again.' });
  }
}