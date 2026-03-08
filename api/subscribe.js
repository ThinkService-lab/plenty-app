export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, source } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwd-xuLj8t3mQABSLZ8m5pe9arxOKr6qRkTLkbDnyS-0UCuhqia-fFRC8FgZLKeV25a/exec';

    const params = new URLSearchParams({
      email: email.trim(),
      source: source || 'Plenty App'
    });

    const response = await fetch(`${SHEETS_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow'
    });

    // Google Apps Script may redirect — just check we got a response
    return res.status(200).json({ success: true });

  } catch (err) {
    // Still return success to user — log the error server side
    console.error('Subscribe error:', err.message);
    return res.status(200).json({ success: true });
  }
}
