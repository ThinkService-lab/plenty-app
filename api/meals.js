export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ ...req.body, model: 'claude-sonnet-4-6' })
    });

    const data = await response.json();

    // Extract and sanitise the JSON text from the AI response before sending to client
    if (data.content && Array.isArray(data.content)) {
      const rawText = data.content.map(b => b.text || '').join('');

      // Find the JSON object boundaries
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');

      if (start !== -1 && end !== -1) {
        let jsonStr = rawText.substring(start, end + 1);

        // Remove all actual newlines/tabs inside strings by collapsing them
        // This is the main cause of JSON parse errors from AI responses
        jsonStr = jsonStr
          .replace(/\r\n/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\t/g, ' ')
          .replace(/[\u0000-\u001F\u007F]/g, ' ');

        try {
          // Validate it parses correctly on the server
          const parsed = JSON.parse(jsonStr);
          // Send back clean pre-parsed data
          return res.status(200).json({ clean: true, parsed });
        } catch(parseErr) {
          // Send raw for client to handle
          return res.status(200).json({ clean: false, raw: jsonStr, original: data });
        }
      }
    }

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
