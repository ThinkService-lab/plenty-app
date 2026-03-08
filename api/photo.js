export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_KEY } }
    );
    const data = await response.json();
    const url = data.photos?.[0]?.src?.large || null;
    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({ url: null, error: err.message });
  }
}
