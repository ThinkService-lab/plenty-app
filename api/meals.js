export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        max_tokens: req.body.max_tokens || 1800,
        messages: req.body.messages
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
        // Clean control characters using char codes to avoid file corruption
        jsonStr = jsonStr.split('').map(c => {
          const code = c.charCodeAt(0);
          if (code === 9 || code === 10 || code === 13) return ' ';
          if (code < 32 || code === 127) return '';
          return c;
        }).join('');

        try {
          const parsed = JSON.parse(jsonStr);
          return res.status(200).json({ clean: true, parsed });
        } catch(parseErr) {
          return res.status(200).json({ clean: false, raw: jsonStr });
        }
      }
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
