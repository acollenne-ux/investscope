import { NextResponse } from 'next/server';

const NEWS_KEY = process.env.NEWS_API_KEY;
const GNEWS_KEY = process.env.GNEWS_API_KEY;
const FMP = process.env.FMP_API_KEY;
const TIINGO_KEY = process.env.TIINGO_API_KEY;

async function fetchJSON(url, timeout = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// ═══════════════════════════════════════════════════════════
// SOURCE 1: GNews (generous rate limits, good FR coverage)
// ═══════════════════════════════════════════════════════════
async function searchGNews(query, lang = 'fr', max = 8) {
  if (!GNEWS_KEY) return [];
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&max=${max}&sortby=publishedAt&apikey=${GNEWS_KEY}`;
  const d = await fetchJSON(url);
  return (d?.articles || []).map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    image: a.image,
    _src: 'gnews'
  }));
}

// ═══════════════════════════════════════════════════════════
// SOURCE 2: NewsAPI (broad coverage, global)
// ═══════════════════════════════════════════════════════════
async function searchNewsAPI(query, lang = 'fr', pageSize = 8) {
  if (!NEWS_KEY) return [];
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${lang}&pageSize=${pageSize}&sortBy=publishedAt&apiKey=${NEWS_KEY}`;
  const d = await fetchJSON(url);
  return (d?.articles || []).map(a => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    image: a.urlToImage,
    _src: 'newsapi'
  }));
}

// ═══════════════════════════════════════════════════════════
// SOURCE 3: FMP Stock News (financial-specific, very relevant)
// ═══════════════════════════════════════════════════════════
async function searchFMPNews(symbol, limit = 10) {
  if (!FMP || !symbol) return [];
  const sym = encodeURIComponent(symbol);
  const url = `https://financialmodelingprep.com/stable/stock-news?symbol=${sym}&limit=${limit}&apikey=${FMP}`;
  const d = await fetchJSON(url);
  return (Array.isArray(d) ? d : []).map(a => ({
    title: a.title,
    description: a.text?.slice(0, 200),
    url: a.url,
    source: a.site || a.publishedDate,
    publishedAt: a.publishedDate,
    image: a.image,
    symbol: a.symbol,
    _src: 'fmp'
  }));
}

// FMP General news (broader market)
async function searchFMPGeneralNews(limit = 10) {
  if (!FMP) return [];
  const url = `https://financialmodelingprep.com/stable/general-news?limit=${limit}&apikey=${FMP}`;
  const d = await fetchJSON(url);
  return (Array.isArray(d) ? d : []).map(a => ({
    title: a.title,
    description: a.text?.slice(0, 200),
    url: a.url,
    source: a.source || a.site,
    publishedAt: a.publishedDate,
    image: a.image,
    _src: 'fmp_general'
  }));
}

// FMP Forex/Crypto news (for macro context)
async function searchFMPForexNews(limit = 5) {
  if (!FMP) return [];
  const url = `https://financialmodelingprep.com/stable/forex-news?limit=${limit}&apikey=${FMP}`;
  const d = await fetchJSON(url);
  return (Array.isArray(d) ? d : []).map(a => ({
    title: a.title,
    description: a.text?.slice(0, 200),
    url: a.url,
    source: a.site,
    publishedAt: a.publishedDate,
    image: a.image,
    _src: 'fmp_forex'
  }));
}

// ═══════════════════════════════════════════════════════════
// SOURCE 4: Tiingo News (financial-specific, high quality)
// ═══════════════════════════════════════════════════════════
async function searchTiingoNews(query, limit = 8) {
  if (!TIINGO_KEY) return [];
  const url = `https://api.tiingo.com/news?tickers=${encodeURIComponent(query)}&limit=${limit}&token=${TIINGO_KEY}`;
  const d = await fetchJSON(url);
  return (Array.isArray(d) ? d : []).map(a => ({
    title: a.title,
    description: a.description?.slice(0, 200),
    url: a.url,
    source: a.source,
    publishedAt: a.publishedDate,
    image: null,
    tickers: a.tickers,
    _src: 'tiingo'
  }));
}

// ═══════════════════════════════════════════════════════════
// SMART COMBINATION: Deduplicate & rank
// ═══════════════════════════════════════════════════════════
function deduplicateAndSort(articles) {
  const seen = new Set();
  const unique = [];
  for (const a of articles) {
    if (!a.title) continue;
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }
  return unique.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

// ═══════════════════════════════════════════════════════════
// SMART QUERY: Build multiple search queries for exhaustiveness
// ═══════════════════════════════════════════════════════════
async function getComprehensiveNews(query, options = {}) {
  const { lang = 'fr', type = 'company', symbol, countryName, max = 15 } = options;

  const allArticles = [];

  if (type === 'stock' && symbol) {
    // For stocks: FMP stock news (most relevant) + Tiingo + GNews + NewsAPI
    const [fmpNews, tiingoNews, gnewsFR, gnewsEN, newsapiFR] = await Promise.all([
      searchFMPNews(symbol, 10),
      searchTiingoNews(symbol, 8),
      searchGNews(`${query} bourse action`, 'fr', 6),
      searchGNews(`${query} stock market`, 'en', 4),
      searchNewsAPI(`${query} action investissement`, 'fr', 6),
    ]);
    allArticles.push(...fmpNews, ...tiingoNews, ...gnewsFR, ...gnewsEN, ...newsapiFR);

  } else if (type === 'country') {
    // For countries: multi-angle search (economy, market, politics, central bank)
    const queries = [
      `${countryName || query} économie bourse 2025 2026`,
      `${countryName || query} banque centrale taux inflation`,
      `${countryName || query} PIB croissance investissement`,
      `${countryName || query} economy market GDP`,
    ];
    const promises = [
      searchGNews(queries[0], 'fr', 6),
      searchGNews(queries[1], 'fr', 5),
      searchNewsAPI(queries[2], 'fr', 5),
      searchNewsAPI(queries[3], 'en', 4),
      searchFMPGeneralNews(8),
    ];
    const results = await Promise.all(promises);
    // Filter general news for country relevance
    const generalFiltered = results[4].filter(a =>
      (a.title + ' ' + (a.description || '')).toLowerCase().includes((countryName || query).toLowerCase())
    );
    results.forEach((r, i) => { if (i < 4) allArticles.push(...r); });
    allArticles.push(...generalFiltered);

  } else {
    // Default: broad search
    const [gnews, newsapi, gnewsEN] = await Promise.all([
      searchGNews(query, lang, 8),
      searchNewsAPI(query, lang, 8),
      searchGNews(query, 'en', 5),
    ]);
    allArticles.push(...gnews, ...newsapi, ...gnewsEN);
  }

  return deduplicateAndSort(allArticles).slice(0, max);
}

export async function POST(request) {
  try {
    const { query, lang, type, symbol, countryName, max } = await request.json();
    if (!query && !symbol) return NextResponse.json({ success: false, error: 'Query ou symbol requis' }, { status: 400 });

    const articles = await getComprehensiveNews(query || symbol, { lang, type, symbol, countryName, max });
    return NextResponse.json({
      success: true,
      data: articles,
      count: articles.length,
      sources: [...new Set(articles.map(a => a._src))],
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
