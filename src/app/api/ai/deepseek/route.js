import { NextResponse } from 'next/server';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

export async function POST(request) {
  try {
    const { prompt, maxTokens = 2000 } = await request.json();
    if (!prompt) return NextResponse.json({ success: false, error: 'Prompt requis' }, { status: 400 });
    if (!DEEPSEEK_KEY) return NextResponse.json({ success: false, error: 'Clé DeepSeek manquante' }, { status: 500 });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Tu es un analyste financier expert. Réponds toujours en français. Sois concis et factuel.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: Math.min(maxTokens, 4000),
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ success: false, error: `DeepSeek ${response.status}: ${err}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ success: true, text, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
