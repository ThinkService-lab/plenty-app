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

    const params = new URLSearchParams({ email, source: source || 'Plenty App' });
    const response = await fetch(`${SHEETS_URL}?${params.toString()}`);
    const data = await response.json();

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
