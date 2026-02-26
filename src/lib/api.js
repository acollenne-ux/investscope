import { storageGet, storageSet } from './storage';

// ── Helpers ──
async function postAPI(endpoint, body) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return await r.json();
}

function extractJSON(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1]); } catch {}
  const m2 = raw.match(/\{[\s\S]*\}/);
  if (m2) try { return JSON.parse(m2[0]); } catch {}
  const m3 = raw.match(/\[[\s\S]*\]/);
  if (m3) try { return JSON.parse(m3[0]); } catch {}
  return null;
}

// ── AI: Mistral (PRIMARY - working, fast, reliable) ──
export async function askMistral(prompt, maxTokens = 2000) {
  const res = await postAPI('/api/ai/mistral', { prompt, maxTokens });
  if (res.success) return res.text;
  throw new Error(res.error || 'Erreur Mistral');
}

// ── AI: DeepSeek (BACKUP - may have no balance) ──
export async function askDeepSeek(prompt, maxTokens = 2000) {
  const res = await postAPI('/api/ai/deepseek', { prompt, maxTokens });
  if (res.success) return res.text;
  throw new Error(res.error || 'Erreur DeepSeek');
}

// ── AI: Claude (BACKUP - complex analysis) ──
export async function askClaude(prompt, maxTokens = 4000) {
  const response = await fetch('/api/claude', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `API ${response.status}`); }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

// ── AI: Smart fallback chain ──
async function askAI(prompt, maxTokens = 2000) {
  // Try Mistral first (primary), then DeepSeek, then Claude
  try { return await askMistral(prompt, maxTokens); } catch (e1) {
    console.warn('Mistral failed:', e1.message);
    try { return await askDeepSeek(prompt, maxTokens); } catch (e2) {
      console.warn('DeepSeek failed:', e2.message);
      return await askClaude(prompt, Math.min(maxTokens, 4000));
    }
  }
}

// ── Real Data: FMP (stock data, ratios, technicals) ──
export async function fetchStockData(symbol) {
  const cached = storageGet(`fmp_${symbol}`);
  if (cached) return cached;
  const res = await postAPI('/api/fmp', { action: 'full_stock', symbol });
  if (res.success) { storageSet(`fmp_${symbol}`, res.data, 12 * 3600); return res.data; }
  return null;
}

export async function searchStocksAPI(query) {
  const cached = storageGet(`search_fmp_${query}`);
  if (cached) return cached;
  const res = await postAPI('/api/fmp', { action: 'search', query });
  if (res.success) { storageSet(`search_fmp_${query}`, res.data, 3600); return res.data; }
  return [];
}

// ── Real Data: Macro (World Bank + FRED + IMF) ──
export async function fetchMacroData(countryCode) {
  const cached = storageGet(`macro_${countryCode}`);
  if (cached) return cached;
  const res = await postAPI('/api/macro', { action: 'country', countryCode });
  if (res.success) { storageSet(`macro_${countryCode}`, res.data, 24 * 3600); return res.data; }
  return null;
}

// ── Real Data: News ──
export async function fetchNews(query, lang = 'fr') {
  const key = `news_${query}_${lang}`;
  const cached = storageGet(key);
  if (cached) return cached;
  const res = await postAPI('/api/news', { query, lang });
  if (res.success) { storageSet(key, res.data, 4 * 3600); return res.data; }
  return [];
}

// ── Composite: Country Analysis (real data + AI) ──
export async function fetchCountryAnalysis(countryName, countryCode) {
  const cacheKey = `country_full_${countryCode}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;

  // 1. Fetch real macro data + news in parallel
  const [macroData, news] = await Promise.all([
    fetchMacroData(countryCode),
    fetchNews(`${countryName} économie bourse 2026`, 'fr')
  ]);

  // 2. Format macro data summary for AI
  const macroSummary = macroData ? Object.entries(macroData).map(([k, v]) => {
    if (!v || v.length === 0) return null;
    const latest = v[0];
    const prev = v.length > 1 ? v[1] : null;
    const trend = prev && latest.value && prev.value ? (latest.value > prev.value ? '↑' : '↓') : '';
    return `${k}: ${latest.value?.toFixed?.(2) ?? latest.value} (${latest.date}) ${trend}`;
  }).filter(Boolean).join('\n') : 'Données non disponibles via World Bank';

  const newsTitles = news.map(a => `- ${a.title} (${a.source}, ${new Date(a.publishedAt).toLocaleDateString('fr-FR')})`).join('\n');

  // 3. Use AI for analysis (Mistral primary, DeepSeek/Claude fallback)
  const prompt = `Tu es un analyste macroéconomique institutionnel. Analyse "${countryName}" (${countryCode}) pour investissement boursier.

DONNÉES MACROÉCONOMIQUES RÉELLES (World Bank/FRED/IMF):
${macroSummary}

ACTUALITÉS RÉCENTES:
${newsTitles || 'Non disponibles'}

Utilise ces données réelles + tes connaissances actualisées. Notes professionnelles et objectives.

Réponds UNIQUEMENT en JSON valide:
{
  "macro_score": <note/10>,
  "geo_score": <note/10>,
  "micro_score": <note/10>,
  "sentiment_score": <note/10>,
  "cycle": "Expansion|Pic|Récession|Rebond",
  "cycle_phase": <0.01 à 99.99>,
  "cycle_reasoning": "<DÉTAILLÉ: pourquoi ce cycle, quels indicateurs le montrent, PMI, crédit, emploi, flux de capitaux>",
  "central_bank_rate": "<taux %>",
  "unemployment_rate": "<taux %>",
  "gdp_last5": [{"year":"2021","value":"x%"},{"year":"2022","value":"x%"},{"year":"2023","value":"x%"},{"year":"2024","value":"x%"},{"year":"2025","value":"x%"}],
  "pmi_manufacturing": "<valeur>",
  "pmi_services": "<valeur>",
  "inflation_cpi": "<valeur %>",
  "inflation_core": "<valeur %>",
  "building_permits_trend": "<tendance permis de construire>",
  "private_credit_trend": "<évolution crédit secteur privé>",
  "capital_flows": "<direction des flux de capitaux et pourquoi>",
  "sectors_buy_strong": [{"name":"<secteur PRÉCIS ex: semi-conducteurs, pas juste technologie>","reason":"<pourquoi>"}],
  "sectors_buy": [{"name":"<secteur>","reason":"<pourquoi>"}],
  "sectors_sell": [{"name":"<secteur>","reason":"<pourquoi>"}],
  "sectors_sell_strong": [{"name":"<secteur>","reason":"<pourquoi>"}],
  "sectors_reasoning": "<raisonnement global sur les secteurs>",
  "top5_stocks": [
    {"symbol":"<TICKER.EXCHANGE réel>","name":"<nom>","sector":"<secteur>","reason":"<pourquoi cette action>","estimated_growth":"<% attendu>","score":8}
  ],
  "news_summary": "<résumé actualité économique et géopolitique>",
  "news_impact_court_terme": "<impact CT sur les cours>",
  "news_impact_moyen_terme": "<impact MT>",
  "news_impact_long_terme": "<impact LT>",
  "macro_reasoning": "<explication DÉTAILLÉE des 4 scores attribués>",
  "imf_estimates": "<estimations FMI pour ce pays si disponibles>"
}`;

  let analysis = null;
  try {
    const raw = await askAI(prompt, 3500);
    analysis = extractJSON(raw);
  } catch (e) {
    console.error('All AIs failed for country analysis:', e.message);
  }

  if (analysis) {
    analysis.overall_score = Math.round(((analysis.macro_score || 0) * 0.3 + (analysis.geo_score || 0) * 0.25 + (analysis.micro_score || 0) * 0.2 + (analysis.sentiment_score || 0) * 0.25) * 10) / 10;
    analysis.news = news;
    analysis.macroData = macroData;
    analysis.updatedAt = new Date().toISOString();
    storageSet(cacheKey, analysis, 24 * 3600);
  }
  return analysis;
}

// ── Composite: Stock Analysis (real data + AI) ──
export async function fetchStockAnalysis(symbol, companyName, countryName) {
  const cacheKey = `stock_full_${symbol}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;

  // 1. Get REAL financial data from FMP + Twelve Data + news
  const [stockData, news] = await Promise.all([
    fetchStockData(symbol),
    fetchNews(`${companyName || symbol} bourse action`, 'fr')
  ]);

  const profile = stockData?.profile;
  const quote = stockData?.quote;
  const ratiosTTM = stockData?.ratiosTTM;
  const growth = stockData?.growth;
  const keyMetrics = stockData?.keyMetrics;
  const income = stockData?.income;
  const balance = stockData?.balance;
  const technicals = stockData?.technicals;
  const dividends = stockData?.dividends;

  const price = quote?.price || profile?.price || 0;
  const per = ratiosTTM?.peRatioTTM || quote?.pe || null;
  const peg = ratiosTTM?.pegRatioTTM || null;
  const payoutRatio = ratiosTTM?.payoutRatioTTM || null;
  const debtToAssets = balance ? (balance.totalDebt / balance.totalAssets) : null;
  const roic = keyMetrics?.roicTTM || null;
  const netMargins = income?.map(i => ({ year: i.calendarYear, margin: i.netIncomeRatio })) || [];
  const rsiLatest = technicals?.rsi?.[0]?.rsi || null;

  // Calc annualized volatility from real price history
  let annualVolatility = 0.3;
  if (technicals?.priceHistory?.length > 20) {
    const closes = technicals.priceHistory.map(p => parseFloat(p.close)).filter(Boolean).reverse();
    const returns = [];
    for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    annualVolatility = Math.sqrt(variance * 252);
  }

  const nextDiv = dividends?.[0] || null;
  const newsTitles = news.map(a => `- ${a.title}`).join('\n');

  // 2. AI analysis on top of real data
  const prompt = `Analyse l'action "${companyName || symbol}" (${symbol}) pour investissement.

DONNÉES FINANCIÈRES RÉELLES (FMP/TwelveData):
- Prix actuel: ${price} ${quote?.currency || ''}
- PER: ${per ?? 'N/A'} | PEG: ${peg ?? 'N/A'}
- Payout Ratio: ${payoutRatio ? (payoutRatio * 100).toFixed(1) + '%' : 'N/A'}
- ROIC: ${roic ? (roic * 100).toFixed(1) + '%' : 'N/A'}
- Dettes/Actifs: ${debtToAssets ? (debtToAssets * 100).toFixed(1) + '%' : 'N/A'}
- Levier: ${keyMetrics?.debtToEquityTTM?.toFixed(2) ?? 'N/A'}
- Évol. marge nette: ${netMargins.map(m => `${m.year}: ${(m.margin * 100).toFixed(1)}%`).join(', ') || 'N/A'}
- Volatilité annuelle: ${(annualVolatility * 100).toFixed(1)}%
- RSI(14): ${rsiLatest ?? 'N/A'}
- Prochain div.: ${nextDiv ? `${nextDiv.dividend} le ${nextDiv.date}` : 'N/A'}

ACTUALITÉS: ${newsTitles || 'Aucune'}

INSTRUCTIONS TP/SL:
- TP: cible >66% proba, basé sur ATR, résistances, volatilité ${(annualVolatility * 100).toFixed(1)}%
- SL: <33% proba d'être touché
- Maximiser ratio gain/perte

Réponds en JSON:
{
  "fundamental_score": <note/10>,
  "technical_score": <note/10>,
  "overall_rating": <note/10>,
  "signal": "acheter_fort|acheter|neutre|vendre|vendre_fort",
  "tp": <prix>,
  "sl": <prix>,
  "tp_probability": <% proba>,
  "sl_probability": <% proba>,
  "gain_pct": <% gain>,
  "loss_pct": <% perte>,
  "gain_loss_ratio": <ratio>,
  "estimated_days": <jours>,
  "tp_reasoning": "<DÉTAILLÉ: pourquoi ce TP, quels niveaux techniques, quelle méthode>",
  "sl_reasoning": "<DÉTAILLÉ: pourquoi ce SL, support utilisé, méthode>",
  "probability_method": "<comment les probabilités sont calculées>",
  "fundamental_analysis": "<analyse fondamentale détaillée avec ratios>",
  "technical_analysis": "<analyse technique détaillée>",
  "score_reasoning": "<pourquoi ces notes>",
  "sharpe_ratio": <estimation>,
  "estimated_growth": "<hausse estimée %>",
  "news_impact_short": "<impact CT>",
  "news_impact_medium": "<impact MT>",
  "news_impact_long": "<impact LT>",
  "next_dividend_date": "${nextDiv?.date || 'N/A'}",
  "next_dividend_pct": "<% dividende>"
}`;

  let aiAnalysis = {};
  try {
    const raw = await askAI(prompt, 3000);
    aiAnalysis = extractJSON(raw) || {};
  } catch (e) {
    console.warn('All AIs failed for stock analysis:', e.message);
  }

  const result = {
    symbol, companyName: companyName || profile?.companyName, countryName,
    price, currency: quote?.currency || profile?.currency,
    per, peg, payoutRatio, roic, debtToAssets,
    leverage: keyMetrics?.debtToEquityTTM,
    netMargins, rsi: rsiLatest, annualVolatility,
    profile, quote, dividends, growth, keyMetrics,
    news, technicals,
    ...aiAnalysis,
    updatedAt: new Date().toISOString()
  };

  storageSet(cacheKey, result, 12 * 3600);
  return result;
}

// ── IBKR-style Stock Search ──
export async function searchStocks(query) {
  if (!query || query.length < 2) return [];
  // First try FMP real search
  const fmpResults = await searchStocksAPI(query);
  if (fmpResults.length > 0) {
    return fmpResults.map(r => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.stockExchange || r.exchangeShortName,
      currency: r.currency
    })).slice(0, 10);
  }
  // Fallback to AI search
  const cacheKey = `search_ai_${query.toLowerCase().trim()}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;
  const prompt = `Recherche les actions correspondant à "${query}" comme sur Interactive Brokers.
Réponds UNIQUEMENT en JSON: [{"symbol":"<TICKER.EXCHANGE>","name":"<nom>","exchange":"<bourse>","currency":"<devise>"}]
Max 8 résultats. Tickers réels avec suffixes (.PA pour Paris, .L pour Londres, .AS pour Amsterdam, etc).`;

  try {
    const raw = await askAI(prompt, 1500);
    const parsed = extractJSON(raw);
    if (parsed && Array.isArray(parsed)) {
      storageSet(cacheKey, parsed, 3600);
      return parsed.slice(0, 8);
    }
  } catch (e) { console.warn('AI search fallback failed:', e.message); }
  return [];
}

// ── Current Price (from FMP quote) ──
export async function fetchCurrentPrice(symbol) {
  try {
    const res = await postAPI('/api/fmp', { action: 'profile', symbol });
    if (res.success) {
      const quote = res.data?.quote;
      const profile = res.data?.profile;
      return {
        price: quote?.price || profile?.price || null,
        currency: quote?.currency || profile?.currency || null,
        change: quote?.change,
        changesPercentage: quote?.changesPercentage,
      };
    }
  } catch {}
  return null;
}

// ── AI-Suggested TP/SL for Portfolio ──
export async function fetchAISuggestedTPSL(symbol, currentPrice, avgCost, quantity) {
  const prompt = `Pour l'action ${symbol}:
- Prix actuel: ${currentPrice}
- PRU (prix moyen d'achat): ${avgCost}
- Quantité: ${quantity}

Suggère un nouveau Take Profit (TP) et Stop Loss (SL) optimaux.
- TP: cible avec >66% de probabilité d'être atteint
- SL: <33% de probabilité d'être touché
- Maximise le ratio gain/perte

Réponds en JSON:
{
  "suggested_tp": <prix>,
  "suggested_sl": <prix>,
  "tp_probability": <% proba>,
  "sl_probability": <% proba>,
  "gain_loss_ratio": <ratio>,
  "reasoning": "<explication détaillée>"
}`;

  try {
    const raw = await askAI(prompt, 1500);
    return extractJSON(raw);
  } catch (e) {
    console.warn('AI TP/SL suggestion failed:', e.message);
  }
  return null;
}