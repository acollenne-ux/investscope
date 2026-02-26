import { NextResponse } from 'next/server';

const MISTRAL_KEY = process.env.MISTRAL_API_KEY;

export async function POST(request) {
  try {
    const { prompt, maxTokens = 2000 } = await request.json();
    if (!prompt) return NextResponse.json({ success: false, error: 'Prompt requis' }, { status: 400 });
    if (!MISTRAL_KEY) return NextResponse.json({ success: false, error: 'Clé Mistral manquante' }, { status: 500 });

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: 'Tu es un analyste financier expert. Réponds toujours en français. Sois concis et factuel. Quand on te demande du JSON, réponds UNIQUEMENT en JSON valide sans markdown.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: Math.min(maxTokens, 4000),
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Mistral API error: ${response.status}`, err);
      return NextResponse.json({ success: false, error: `Mistral ${response.status}: ${err}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ success: true, text, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Mistral route error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
