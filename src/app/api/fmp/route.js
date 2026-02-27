import { NextResponse } from 'next/server';

const FMP = process.env.FMP_API_KEY;
const TWELVE = process.env.TWELVE_DATA_API_KEY;
// FMP Stable API (v3 legacy endpoints died Aug 2025)
const BASE = 'https://financialmodelingprep.com/stable';

async function fetchJSON(url, timeout = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) {
      console.warn(`FMP fetch failed: ${r.status} for ${url.split('apikey=')[0]}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.warn(`FMP fetch error: ${e.message}`);
    return null;
  } finally { clearTimeout(t); }
}

// Profile + quote (stable API: query params, not path params)
// NOTE: quote endpoint is premium for non-US stocks
// profile always works and contains price, change, currency, marketCap etc.
async function getStockProfile(symbol) {
  const sym = encodeURIComponent(symbol);
  const [profile, quote] = await Promise.all([
    fetchJSON(`${BASE}/profile?symbol=${sym}&apikey=${FMP}`),
    fetchJSON(`${BASE}/quote?symbol=${sym}&apikey=${FMP}`)
  ]);
  const profileArr = Array.isArray(profile) ? profile : (profile ? [profile] : []);
  const quoteArr = Array.isArray(quote) ? quote : (quote ? [quote] : []);
  const profileData = profileArr[0] || null;
  let quoteData = quoteArr[0] || null;

  // If quote is not available (premium/non-US), build quote-like object from profile
  if (!quoteData && profileData) {
    quoteData = {
      price: profileData.price,
      change: profileData.change,
      changesPercentage: profileData.changePercentage,
      currency: profileData.currency,
      marketCap: profileData.marketCap,
      volume: profileData.volume,
      avgVolume: profileData.averageVolume,
      name: profileData.companyName,
      exchange: profileData.exchange,
      pe: null, // Not available in profile
      _fromProfile: true
    };
  }
  return { profile: profileData, quote: quoteData };
}

// Financial ratios (stable API)
async function getRatios(symbol) {
  const sym = encodeURIComponent(symbol);
  const [ratios, growth, metrics] = await Promise.all([
    fetchJSON(`${BASE}/ratios-ttm?symbol=${sym}&apikey=${FMP}`),
    fetchJSON(`${BASE}/financial-growth?symbol=${sym}&limit=5&apikey=${FMP}`),
    fetchJSON(`${BASE}/key-metrics-ttm?symbol=${sym}&apikey=${FMP}`)
  ]);
  const ratiosArr = Array.isArray(ratios) ? ratios : [];
  const metricsArr = Array.isArray(metrics) ? metrics : [];
  return {
    ratiosTTM: ratiosArr[0] || null,
    growth: Array.isArray(growth) ? growth : [],
    keyMetrics: metricsArr[0] || null
  };
}

// Income statement + balance sheet (stable API)
async function getFinancials(symbol) {
  const sym = encodeURIComponent(symbol);
  const [income, balance] = await Promise.all([
    fetchJSON(`${BASE}/income-statement?symbol=${sym}&limit=5&apikey=${FMP}`),
    fetchJSON(`${BASE}/balance-sheet-statement?symbol=${sym}&limit=1&apikey=${FMP}`)
  ]);
  const incomeArr = Array.isArray(income) ? income : [];
  const balanceArr = Array.isArray(balance) ? balance : [];
  return { income: incomeArr, balance: balanceArr[0] || null };
}

// Technical indicators from Twelve Data (unchanged)
async function getTechnicals(symbol) {
  if (!TWELVE) return { rsi: [], macd: [], priceHistory: [] };
  const base12 = 'https://api.twelvedata.com';
  const sym = encodeURIComponent(symbol);
  const [rsi, macd, price] = await Promise.all([
    fetchJSON(`${base12}/rsi?symbol=${sym}&interval=1day&outputsize=30&apikey=${TWELVE}`),
    fetchJSON(`${base12}/macd?symbol=${sym}&interval=1day&outputsize=30&apikey=${TWELVE}`),
    fetchJSON(`${base12}/time_series?symbol=${sym}&interval=1day&outputsize=252&apikey=${TWELVE}`)
  ]);
  return { rsi: rsi?.values || [], macd: macd?.values || [], priceHistory: price?.values || [] };
}

// Dividends (stable API)
async function getDividends(symbol) {
  const sym = encodeURIComponent(symbol);
  // Try stable endpoint first
  const data = await fetchJSON(`${BASE}/historical-price-full/stock_dividend?symbol=${sym}&apikey=${FMP}`);
  if (data?.historical) return data.historical.slice(0, 5);
  // Fallback: try stock_dividend_calendar
  const cal = await fetchJSON(`${BASE}/stock-dividend-calendar?symbol=${sym}&apikey=${FMP}`);
  return Array.isArray(cal) ? cal.slice(0, 5) : [];
}

// Stock search (stable API: search-name, NOT search)
async function searchStocks(query) {
  const q = encodeURIComponent(query);
  const data = await fetchJSON(`${BASE}/search-name?query=${q}&limit=15&apikey=${FMP}`);
  return Array.isArray(data) ? data : [];
}

// Sector performance (stable API)
async function getSectorPerf() {
  const data = await fetchJSON(`${BASE}/sector-performance?apikey=${FMP}`);
  return Array.isArray(data) ? data : [];
}

// Country stock screener (stable API)
async function getCountryStocks(exchange, limit = 10) {
  const data = await fetchJSON(`${BASE}/stock-screener?exchange=${encodeURIComponent(exchange)}&limit=${limit}&apikey=${FMP}`);
  return Array.isArray(data) ? data : [];
}

export async function POST(request) {
  try {
    const { action, symbol, query, exchange } = await request.json();

    switch (action) {
      case 'profile': {
        const data = await getStockProfile(symbol);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'ratios': {
        const data = await getRatios(symbol);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'financials': {
        const data = await getFinancials(symbol);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'technicals': {
        const data = await getTechnicals(symbol);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'dividends': {
        const data = await getDividends(symbol);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'search': {
        const data = await searchStocks(query);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'sectors': {
        const data = await getSectorPerf();
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'country_stocks': {
        const data = await getCountryStocks(exchange);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'full_stock': {
        const [profileData, ratiosData, financialsData, techData, divData] = await Promise.all([
          getStockProfile(symbol),
          getRatios(symbol),
          getFinancials(symbol),
          getTechnicals(symbol),
          getDividends(symbol)
        ]);
        return NextResponse.json({
          success: true,
          data: { ...profileData, ...ratiosData, ...financialsData, technicals: techData, dividends: divData },
          updatedAt: new Date().toISOString()
        });
      }
      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e) {
    console.error('FMP route error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
