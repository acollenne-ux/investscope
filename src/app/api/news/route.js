import { NextResponse } from 'next/server';

const NEWS_KEY = process.env.NEWS_API_KEY;
const GNEWS_KEY = process.env.GNEWS_API_KEY;

async function fetchJSON(url, timeout = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// GNews (more generous rate limits)
async function searchGNews(query, lang = 'fr', max = 5) {
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&max=${max}&apikey=${GNEWS_KEY}`;
  const d = await fetchJSON(url);
  return (d?.articles || []).map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    image: a.image
  }));
}

// NewsAPI (broader coverage)
async function searchNewsAPI(query, lang = 'fr', pageSize = 5) {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${lang}&pageSize=${pageSize}&sortBy=publishedAt&apiKey=${NEWS_KEY}`;
  const d = await fetchJSON(url);
  return (d?.articles || []).map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    image: a.urlToImage
  }));
}

// Combine both sources, deduplicate
async function getNews(query, lang = 'fr') {
  const [gnews, newsapi] = await Promise.all([
    searchGNews(query, lang, 5),
    searchNewsAPI(query, lang, 5)
  ]);

  const seen = new Set();
  const combined = [];
  for (const a of [...gnews, ...newsapi]) {
    const key = a.title?.toLowerCase().slice(0, 50);
    if (key && !seen.has(key)) {
      seen.add(key);
      combined.push(a);
    }
  }

  return combined.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 8);
}

export async function POST(request) {
  try {
    const { query, lang } = await request.json();
    if (!query) return NextResponse.json({ success: false, error: 'Query requise' }, { status: 400 });

    const articles = await getNews(query, lang || 'fr');
    return NextResponse.json({ success: true, data: articles, updatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
