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

// ── AI: Mistral (PRIMARY) ──
export async function askMistral(prompt, maxTokens = 2000) {
  const res = await postAPI('/api/ai/mistral', { prompt, maxTokens });
  if (res.success) return res.text;
  throw new Error(res.error || 'Erreur Mistral');
}

// ── AI: DeepSeek (BACKUP) ──
export async function askDeepSeek(prompt, maxTokens = 2000) {
  const res = await postAPI('/api/ai/deepseek', { prompt, maxTokens });
  if (res.success) return res.text;
  throw new Error(res.error || 'Erreur DeepSeek');
}

// ── AI: Claude (BACKUP) ──
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
  try { return await askMistral(prompt, maxTokens); } catch (e1) {
    console.warn('Mistral failed:', e1.message);
    try { return await askDeepSeek(prompt, maxTokens); } catch (e2) {
      console.warn('DeepSeek failed:', e2.message);
      return await askClaude(prompt, Math.min(maxTokens, 4000));
    }
  }
}

// ══════════════════════════════════════════════════════════
// DATA FETCHING: Stocks (FMP)
// ══════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════
// DATA FETCHING: ETFs (FMP)
// ══════════════════════════════════════════════════════════
export async function fetchETFData(symbol) {
  const cached = storageGet(`etf_${symbol}`);
  if (cached) return cached;
  const res = await postAPI('/api/fmp', { action: 'full_etf', symbol });
  if (res.success) { storageSet(`etf_${symbol}`, res.data, 12 * 3600); return res.data; }
  return null;
}

// ══════════════════════════════════════════════════════════
// DATA FETCHING: Macro (World Bank + IMF WEO + FRED)
// Returns { worldBank, imf, gdpForecasts }
// ══════════════════════════════════════════════════════════
export async function fetchMacroData(countryCode) {
  const cached = storageGet(`macro_${countryCode}`);
  if (cached) return cached;
  const res = await postAPI('/api/macro', { action: 'country', countryCode });
  if (res.success) { storageSet(`macro_${countryCode}`, res.data, 24 * 3600); return res.data; }
  return null;
}

// ══════════════════════════════════════════════════════════
// DATA FETCHING: News (multi-source)
// ══════════════════════════════════════════════════════════
export async function fetchNews(query, options = {}) {
  const { lang = 'fr', type = 'company', symbol, countryName, max = 15 } = options;
  const key = `news_${type}_${symbol || query}_${lang}`;
  const cached = storageGet(key);
  if (cached) return cached;
  const res = await postAPI('/api/news', { query, lang, type, symbol, countryName, max });
  if (res.success) { storageSet(key, res.data, 4 * 3600); return res.data; }
  return [];
}

// ══════════════════════════════════════════════════════════
// FORMATTING: Macro data → AI prompt text
// Handles new structure: { worldBank, imf, gdpForecasts }
// ══════════════════════════════════════════════════════════
function formatMacroForPrompt(macroData, countryCode) {
  if (!macroData) return 'Données macro non disponibles';
  const parts = [];

  // World Bank data
  if (macroData.worldBank) {
    const wb = macroData.worldBank;
    const fmtWB = (key, label, unit = '') => {
      const arr = wb[key];
      if (!arr || arr.length === 0) return null;
      const latest = arr[0];
      const prev = arr.length > 1 ? arr[1] : null;
      const val = typeof latest.value === 'number' ? latest.value.toFixed(2) : latest.value;
      const trend = prev && latest.value != null && prev.value != null ? (latest.value > prev.value ? '↑' : '↓') : '';
      return `  ${label}: ${val}${unit} (${latest.date}) ${trend}`;
    };
    const wbLines = [
      fmtWB('gdp', 'PIB nominal', ' USD'),
      fmtWB('gdpGrowth', 'Croissance PIB', '%'),
      fmtWB('inflation', 'Inflation CPI', '%'),
      fmtWB('unemployment', 'Chômage', '%'),
      fmtWB('currentAccount', 'Balance courante/PIB', '%'),
      fmtWB('debtGDP', 'Dette publique/PIB', '%'),
      fmtWB('tradeBalance', 'Balance commerciale/PIB', '%'),
      fmtWB('fdi', 'IDE/PIB', '%'),
      fmtWB('domesticCredit', 'Crédit privé/PIB', '%'),
      fmtWB('grossCapitalFormation', 'Formation capital brut/PIB', '%'),
      fmtWB('realInterestRate', 'Taux intérêt réel', '%'),
      fmtWB('stocksTraded', 'Actions échangées/PIB', '%'),
      fmtWB('industryGDP', 'Industrie/PIB', '%'),
      fmtWB('servicesGDP', 'Services/PIB', '%'),
      fmtWB('exportsGDP', 'Exports/PIB', '%'),
      fmtWB('broadMoney', 'Masse monétaire M2/PIB', '%'),
    ].filter(Boolean);
    if (wbLines.length > 0) {
      parts.push('WORLD BANK (historique fiable):\n' + wbLines.join('\n'));
    }
  }

  // IMF WEO data
  if (macroData.imf) {
    const imf = macroData.imf;
    const fmtIMF = (key, label, unit = '%') => {
      const arr = imf[key];
      if (!arr || arr.length === 0) return null;
      const currentYear = new Date().getFullYear();
      // Get latest actual + forecasts
      const recent = arr.filter(d => parseInt(d.date) >= currentYear - 2 && parseInt(d.date) <= currentYear + 2);
      if (recent.length === 0) return null;
      const vals = recent.map(d => `${d.date}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value}${unit}${parseInt(d.date) >= currentYear ? ' (prév.)' : ''}`);
      return `  ${label}: ${vals.join(' | ')}`;
    };
    const imfLines = [
      fmtIMF('gdpGrowth', 'PIB croissance réelle'),
      fmtIMF('gdpNominal', 'PIB nominal', ' Mds$'),
      fmtIMF('gdpPerCapitaPPP', 'PIB/hab PPP', '$'),
      fmtIMF('outputGap', 'OUTPUT GAP (écart potentiel)'),
      fmtIMF('inflationCPI', 'Inflation CPI'),
      fmtIMF('govDebtGDP', 'Dette publique/PIB'),
      fmtIMF('govBalance', 'Solde budgétaire/PIB'),
      fmtIMF('currentAccount', 'Balance courante/PIB'),
      fmtIMF('unemployment', 'Chômage'),
    ].filter(Boolean);
    if (imfLines.length > 0) {
      parts.push('IMF WEO (prévisions institutionnelles):\n' + imfLines.join('\n'));
    }
  }

  // GDP Forecasts
  if (macroData.gdpForecasts && macroData.gdpForecasts.length > 0) {
    const fLines = macroData.gdpForecasts.map(d =>
      `  ${d.year}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value}%${d.isForecast ? ' ★PRÉVISION' : ''}`
    );
    parts.push('PRÉVISIONS PIB FMI (historique + projections):\n' + fLines.join('\n'));
  }

  return parts.join('\n\n') || 'Données limitées';
}

// ══════════════════════════════════════════════════════════
// COMPOSITE: Country Analysis — Institutional Grade
// Uses NBER/CEPR methodology + IMF output gap + sector rotation
// ══════════════════════════════════════════════════════════
export async function fetchCountryAnalysis(countryName, countryCode) {
  const cacheKey = `country_full_${countryCode}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;

  // 1. Fetch real macro data + news in parallel
  const [macroData, news] = await Promise.all([
    fetchMacroData(countryCode),
    fetchNews(`${countryName} économie bourse 2026`, {
      lang: 'fr', type: 'country', countryName, max: 15
    })
  ]);

  // 2. Format macro data for AI
  const macroSummary = formatMacroForPrompt(macroData, countryCode);
  const newsTitles = news.map(a => `- ${a.title} (${a.source || a._src}, ${new Date(a.publishedAt).toLocaleDateString('fr-FR')})`).join('\n');

  // 3. Institutional-grade AI prompt
  const prompt = `Tu es un analyste macroéconomique INSTITUTIONNEL de niveau hedge fund. Analyse "${countryName}" (${countryCode}).

═══ DONNÉES RÉELLES ═══
${macroSummary}

═══ ACTUALITÉS (${news.length} sources) ═══
${newsTitles || 'Non disponibles'}

═══ MÉTHODOLOGIE CYCLE OBLIGATOIRE ═══
Utilise la méthodologie NBER/CEPR pour déterminer le cycle:
1. OUTPUT GAP: Positif = économie au-dessus du potentiel (fin expansion/pic), Négatif = en-dessous (récession/début rebond)
2. INDICATEURS AVANCÉS: crédit privé, formation de capital, confiance des entreprises, courbe des taux
3. INDICATEURS RETARDÉS: chômage, inflation core, dette/PIB, balance commerciale
4. DYNAMIQUE: comparer la direction (accélération/décélération) pas juste le niveau

PHASES (précises):
- Expansion: output gap se referme vers 0 par le haut, croissance accélère, crédit augmente, chômage baisse
- Pic: output gap maximum positif, inflation accélère, resserrement monétaire, euphorie marchés
- Récession: output gap se creuse, croissance décélère/négative, crédit se contracte, chômage monte
- Rebond: output gap minimum négatif, premiers signaux de reprise, politique monétaire accommodante

ROTATION SECTORIELLE (méthodologie institutionnelle):
- Début Expansion: Financières, Immobilier, Consommation discrétionnaire, Small caps
- Milieu Expansion: Technologie, Industrie, Matériaux
- Fin Expansion/Pic: Énergie, Matières premières, Utilities défensives
- Récession: Santé, Utilities, Consommation de base, Obligations, Or
- Rebond: Financières, Immobilier, Semi-conducteurs, Construction

Réponds UNIQUEMENT en JSON valide:
{
  "macro_score": <note/10>,
  "geo_score": <note/10>,
  "micro_score": <note/10>,
  "sentiment_score": <note/10>,
  "cycle": "Expansion|Pic|Récession|Rebond",
  "cycle_phase": <1-99, précision: 1=tout début, 50=milieu, 99=fin de cette phase>,
  "cycle_methodology": "<DÉTAILLÉ: output gap actuel estimé, indicateurs avancés utilisés, comparaison avec méthodologie NBER, signaux de transition>",
  "cycle_confidence": "<haute|moyenne|basse + pourquoi>",
  "cycle_next_phase": "<prochaine phase attendue et horizon temporel estimé>",
  "central_bank_rate": "<taux directeur %>",
  "central_bank_bias": "<hawkish|neutre|dovish + contexte>",
  "unemployment_rate": "<taux %>",
  "gdp_forecasts": ${JSON.stringify(macroData?.gdpForecasts || [])},
  "output_gap_estimate": "<estimation output gap % avec source>",
  "pmi_manufacturing": "<valeur>",
  "pmi_services": "<valeur>",
  "inflation_cpi": "<valeur %>",
  "inflation_core": "<valeur %>",
  "inflation_trend": "<accélération|stable|décélération>",
  "credit_growth": "<tendance crédit secteur privé>",
  "capital_flows": "<direction des flux et pourquoi>",
  "yield_curve": "<description forme courbe des taux>",
  "sectors_strong_buy": [{"name":"<secteur PRÉCIS>","reason":"<justification cycle + fondamentaux>","phase_alignment":"<alignement avec phase cycle>"}],
  "sectors_buy": [{"name":"<secteur>","reason":"<pourquoi>","phase_alignment":"<alignement>"}],
  "sectors_sell": [{"name":"<secteur>","reason":"<pourquoi>","phase_alignment":"<alignement>"}],
  "sectors_strong_sell": [{"name":"<secteur>","reason":"<pourquoi>","phase_alignment":"<alignement>"}],
  "sectors_reasoning": "<raisonnement rotation sectorielle lié au cycle>",
  "top5_stocks": [
    {"symbol":"<TICKER.EXCHANGE>","name":"<nom>","sector":"<secteur>","reason":"<pourquoi>","estimated_growth":"<% attendu>","score":8}
  ],
  "news_summary": "<résumé actualités>",
  "news_impact_court_terme": "<impact CT>",
  "news_impact_moyen_terme": "<impact MT>",
  "news_impact_long_terme": "<impact LT>",
  "macro_reasoning": "<justification DÉTAILLÉE des 4 scores>",
  "risk_factors": ["<risque 1>","<risque 2>","<risque 3>"],
  "catalysts": ["<catalyseur positif 1>","<catalyseur 2>"]
}`;

  let analysis = null;
  try {
    const raw = await askAI(prompt, 4000);
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

// ══════════════════════════════════════════════════════════
// COMPOSITE: Stock Analysis (enhanced fundamentals + news)
// ══════════════════════════════════════════════════════════
export async function fetchStockAnalysis(symbol, companyName, countryName) {
  const cacheKey = `stock_full_${symbol}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;

  // 1. Get REAL financial data + news in parallel
  const [stockData, news] = await Promise.all([
    fetchStockData(symbol),
    fetchNews(`${companyName || symbol} bourse action`, {
      lang: 'fr', type: 'stock', symbol: symbol.split('.')[0], max: 12
    })
  ]);

  const profile = stockData?.profile;
  const quote = stockData?.quote;
  const ratiosTTM = stockData?.ratiosTTM;
  const growth = stockData?.growth;
  const keyMetrics = stockData?.keyMetrics;
  const income = stockData?.income;
  const balance = stockData?.balance;
  const cashFlow = stockData?.cashFlow;
  const technicals = stockData?.technicals;
  const dividends = stockData?.dividends;

  const price = quote?.price || profile?.price || 0;
  const per = ratiosTTM?.peRatioTTM || quote?.pe || null;
  const peg = ratiosTTM?.pegRatioTTM || null;
  const payoutRatio = ratiosTTM?.payoutRatioTTM || null;
  const debtToAssets = balance ? (balance.totalDebt / balance.totalAssets) : null;
  const roic = keyMetrics?.roicTTM || null;
  const roe = keyMetrics?.roeTTM || null;
  const roa = keyMetrics?.returnOnTangibleAssetsTTM || null;
  const netMargins = income?.map(i => ({ year: i.calendarYear, margin: i.netIncomeRatio })) || [];
  const rsiLatest = technicals?.rsi?.[0]?.rsi || null;

  // Cash flow metrics
  const freeCashFlow = cashFlow?.[0]?.freeCashFlow || null;
  const operatingCF = cashFlow?.[0]?.operatingCashFlow || null;
  const capex = cashFlow?.[0]?.capitalExpenditure || null;

  // Volatility calculation
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
  const newsTitles = news.map(a => `- ${a.title} (${a.source || a._src})`).join('\n');

  // 2. AI analysis
  const prompt = `Analyse l'action "${companyName || symbol}" (${symbol}) pour investissement.

DONNÉES FINANCIÈRES RÉELLES (FMP):
- Prix: ${price} ${quote?.currency || ''}
- PER: ${per ?? 'N/A'} | PEG: ${peg ?? 'N/A'}
- Payout Ratio: ${payoutRatio ? (payoutRatio * 100).toFixed(1) + '%' : 'N/A'}
- ROIC: ${roic ? (roic * 100).toFixed(1) + '%' : 'N/A'} | ROE: ${roe ? (roe * 100).toFixed(1) + '%' : 'N/A'}
- Dettes/Actifs: ${debtToAssets ? (debtToAssets * 100).toFixed(1) + '%' : 'N/A'}
- Levier D/E: ${keyMetrics?.debtToEquityTTM?.toFixed(2) ?? 'N/A'}
- Marge nette: ${netMargins.map(m => `${m.year}: ${(m.margin * 100).toFixed(1)}%`).join(', ') || 'N/A'}
- Free Cash Flow: ${freeCashFlow ? (freeCashFlow / 1e6).toFixed(0) + 'M' : 'N/A'}
- Cash Flow Opérationnel: ${operatingCF ? (operatingCF / 1e6).toFixed(0) + 'M' : 'N/A'}
- CAPEX: ${capex ? (capex / 1e6).toFixed(0) + 'M' : 'N/A'}
- Volatilité: ${(annualVolatility * 100).toFixed(1)}%
- RSI(14): ${rsiLatest ?? 'N/A'}
- Prochain div.: ${nextDiv ? `${nextDiv.dividend} le ${nextDiv.date}` : 'N/A'}

ACTUALITÉS (${news.length} articles): ${newsTitles || 'Aucune'}

TP/SL: TP cible >66% proba (basé ATR, résistances, vol ${(annualVolatility * 100).toFixed(1)}%), SL <33% proba. Maximiser ratio gain/perte.

JSON:
{
  "fundamental_score": <note/10>,
  "technical_score": <note/10>,
  "overall_rating": <note/10>,
  "signal": "acheter_fort|acheter|neutre|vendre|vendre_fort",
  "tp": <prix>, "sl": <prix>,
  "tp_probability": <% proba>, "sl_probability": <% proba>,
  "gain_pct": <% gain>, "loss_pct": <% perte>,
  "gain_loss_ratio": <ratio>, "estimated_days": <jours>,
  "tp_reasoning": "<détaillé>", "sl_reasoning": "<détaillé>",
  "fundamental_analysis": "<analyse fondamentale avec ratios + cash flow>",
  "technical_analysis": "<analyse technique>",
  "score_reasoning": "<pourquoi ces notes>",
  "sharpe_ratio": <estimation>,
  "estimated_growth": "<% attendu>",
  "news_impact_short": "<CT>", "news_impact_medium": "<MT>", "news_impact_long": "<LT>",
  "next_dividend_date": "${nextDiv?.date || 'N/A'}",
  "next_dividend_pct": "<% div>"
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
    per, peg, payoutRatio, roic, roe, roa, debtToAssets,
    leverage: keyMetrics?.debtToEquityTTM,
    freeCashFlow, operatingCF, capex,
    netMargins, rsi: rsiLatest, annualVolatility,
    profile, quote, dividends, growth, keyMetrics, cashFlow,
    news, technicals,
    ...aiAnalysis,
    updatedAt: new Date().toISOString()
  };

  storageSet(cacheKey, result, 12 * 3600);
  return result;
}

// ══════════════════════════════════════════════════════════
// COMPOSITE: ETF Analysis (profile + holdings + AI)
// ══════════════════════════════════════════════════════════
export async function fetchETFAnalysis(symbol, etfName) {
  const cacheKey = `etf_full_${symbol}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;

  // 1. Get ETF data + news in parallel
  const [etfData, news] = await Promise.all([
    fetchETFData(symbol),
    fetchNews(`${etfName || symbol} ETF`, {
      lang: 'fr', type: 'stock', symbol: symbol.split('.')[0], max: 10
    })
  ]);

  if (!etfData) return null;

  const holdings = etfData.holdings || [];
  const sectorWeights = etfData.sectorWeights || [];
  const countryWeights = etfData.countryWeights || [];
  const technicals = etfData.technicals;
  const profile = etfData.profile;
  const quote = etfData.quote;
  const price = quote?.price || profile?.price || 0;

  // Top holdings summary
  const topHoldings = holdings.slice(0, 10).map(h =>
    `${h.asset || h.symbol}: ${h.weightPercentage ? h.weightPercentage.toFixed(2) + '%' : 'N/A'}`
  ).join(', ');

  // Sector summary
  const sectorSummary = sectorWeights.slice(0, 5).map(s =>
    `${s.sector}: ${s.weightPercentage ? s.weightPercentage.toFixed(1) + '%' : 'N/A'}`
  ).join(', ');

  // Country summary
  const countrySummary = countryWeights.slice(0, 5).map(c =>
    `${c.country}: ${c.weightPercentage ? c.weightPercentage.toFixed(1) + '%' : 'N/A'}`
  ).join(', ');

  const rsiLatest = technicals?.rsi?.[0]?.rsi || null;
  const newsTitles = news.map(a => `- ${a.title}`).join('\n');

  // Volatility
  let annualVolatility = 0.2;
  if (technicals?.priceHistory?.length > 20) {
    const closes = technicals.priceHistory.map(p => parseFloat(p.close)).filter(Boolean).reverse();
    const returns = [];
    for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
    annualVolatility = Math.sqrt(variance * 252);
  }

  // 2. AI analysis
  const prompt = `Analyse l'ETF "${etfName || symbol}" (${symbol}).

DONNÉES RÉELLES:
- Prix: ${price} ${quote?.currency || ''}
- TER/Frais: ${etfData.etfInfo?.expenseRatio ? (etfData.etfInfo.expenseRatio * 100).toFixed(2) + '%' : profile?.expenseRatio || 'N/A'}
- AUM: ${etfData.etfInfo?.totalAssets ? (etfData.etfInfo.totalAssets / 1e9).toFixed(2) + ' Mds' : 'N/A'}
- Top 10 positions: ${topHoldings || 'N/A'}
- Répartition sectorielle: ${sectorSummary || 'N/A'}
- Répartition géographique: ${countrySummary || 'N/A'}
- Volatilité: ${(annualVolatility * 100).toFixed(1)}%
- RSI(14): ${rsiLatest ?? 'N/A'}
- Nb positions: ${holdings.length || 'N/A'}

ACTUALITÉS: ${newsTitles || 'Aucune'}

TP/SL: TP cible >66% proba, SL <33% proba, maximiser ratio.

JSON:
{
  "fundamental_score": <note/10>,
  "technical_score": <note/10>,
  "overall_rating": <note/10>,
  "signal": "acheter_fort|acheter|neutre|vendre|vendre_fort",
  "tp": <prix>, "sl": <prix>,
  "tp_probability": <% proba>, "sl_probability": <% proba>,
  "gain_pct": <% gain>, "loss_pct": <% perte>,
  "gain_loss_ratio": <ratio>, "estimated_days": <jours>,
  "etf_analysis": "<analyse complète: stratégie, risque, frais, diversification, qualité du tracking>",
  "sector_analysis": "<analyse rotation sectorielle dans le contexte cycle actuel>",
  "geographic_analysis": "<analyse géographique, risques pays>",
  "technical_analysis": "<analyse technique>",
  "score_reasoning": "<justification notes>",
  "estimated_growth": "<% attendu>",
  "news_impact_short": "<CT>", "news_impact_medium": "<MT>", "news_impact_long": "<LT>"
}`;

  let aiAnalysis = {};
  try {
    const raw = await askAI(prompt, 3000);
    aiAnalysis = extractJSON(raw) || {};
  } catch (e) {
    console.warn('All AIs failed for ETF analysis:', e.message);
  }

  const result = {
    symbol, etfName: etfName || profile?.companyName || symbol,
    isETF: true,
    price, currency: quote?.currency || profile?.currency,
    profile, quote, holdings, sectorWeights, countryWeights,
    etfInfo: etfData.etfInfo, stockExposure: etfData.stockExposure,
    technicals, rsi: rsiLatest, annualVolatility,
    news,
    ...aiAnalysis,
    updatedAt: new Date().toISOString()
  };

  storageSet(cacheKey, result, 12 * 3600);
  return result;
}

// ══════════════════════════════════════════════════════════
// IBKR-style Stock/ETF Search
// ══════════════════════════════════════════════════════════
export async function searchStocks(query) {
  if (!query || query.length < 2) return [];
  const fmpResults = await searchStocksAPI(query);
  if (fmpResults.length > 0) {
    return fmpResults.map(r => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.stockExchange || r.exchangeShortName,
      currency: r.currency,
      isETF: (r.stockExchange || '').toLowerCase().includes('etf') ||
             (r.name || '').toLowerCase().includes('etf') ||
             (r.exchangeShortName || '').toUpperCase() === 'ETF'
    })).slice(0, 12);
  }
  // Fallback AI search
  const cacheKey = `search_ai_${query.toLowerCase().trim()}`;
  const cached = storageGet(cacheKey);
  if (cached) return cached;
  const prompt = `Recherche les actions/ETFs correspondant à "${query}" comme sur Interactive Brokers.
Réponds UNIQUEMENT en JSON: [{"symbol":"<TICKER.EXCHANGE>","name":"<nom>","exchange":"<bourse>","currency":"<devise>","isETF":false}]
Max 8 résultats. Tickers réels avec suffixes (.PA pour Paris, .L pour Londres, etc). Inclure ETFs si pertinent.`;

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
- PRU: ${avgCost}
- Quantité: ${quantity}

Suggère TP et SL optimaux. TP >66% proba, SL <33% proba. Maximise ratio gain/perte.

JSON: {"suggested_tp":<prix>,"suggested_sl":<prix>,"tp_probability":<%>,"sl_probability":<%>,"gain_loss_ratio":<ratio>,"reasoning":"<explication>"}`;

  try {
    const raw = await askAI(prompt, 1500);
    return extractJSON(raw);
  } catch (e) {
    console.warn('AI TP/SL suggestion failed:', e.message);
  }
  return null;
}
