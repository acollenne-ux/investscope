export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'sk-ant-VOTRE_CLE_ICI') {
    return Response.json({ error: 'Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans les variables d\'environnement Vercel.' }, { status: 500 });
  }

  try {
    const { prompt, maxTokens = 4000 } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt invalide' }, { status: 400 });
    }
    const clampedTokens = Math.min(Math.max(maxTokens, 100), 8000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: clampedTokens,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText.substring(0, 500));
      return Response.json({ error: `Erreur API Anthropic: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const textContent = data.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n') || '';

    return Response.json({ text: textContent });
  } catch (e) {
    console.error('API route error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
