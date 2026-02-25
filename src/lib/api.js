import { storage } from './storage';

function extractJSON(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  try {
    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    if (firstBracket >= 0) {
      return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
    }
  } catch (e) {
    console.error('JSON parse error:', e.message, cleaned.substring(0, 200));
  }
  return null;
}

async function askClaude(prompt, maxTokens = 4000) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

export async function fetchCountryAnalysis(countryName, countryCode) {
  const cached = storage.get(`country_${countryCode}`);
  if (cached) return cached;

  const prompt = `Tu es un analyste financier professionnel. Analyse le pays "${countryName}" (${countryCode}) pour l'investissement boursier en février 2026. Utilise des données réelles et actuelles.

RÉPONDS UNIQUEMENT en JSON valide, sans markdown, sans backticks. Format exact :
{
  "macro_score": <note/10 basée sur PIB, inflation, taux, emploi>,
  "geo_score": <note/10 risques géopolitiques, stabilité, sanctions>,
  "micro_score": <note/10 environnement des affaires, réglementation, investissement étranger>,
  "sentiment_score": <note/10 flux de capitaux, sentiment marché, spéculation>,
  "cycle": "<Expansion|Pic|Récession|Rebond>",
  "cycle_phase": <0.01 à 99.99>,
  "cycle_explanation": "<explication 2-3 phrases>",
  "central_bank_rate": <taux directeur actuel>,
  "unemployment": <taux de chômage>,
  "gdp_growth_5y": [<5 dernières années>],
  "pmi_manufacturing": <PMI manufacturier>,
  "pmi_services": <PMI services>,
  "inflation_cpi": <inflation CPI>,
  "inflation_core": <inflation core>,
  "sectors_buy": [{"name":"<secteur précis>","signal":"<ACHETER FORT|ACHETER>","reason":"<pourquoi>"}],
  "sectors_sell": [{"name":"<secteur>","signal":"<VENDRE|VENDRE FORT>","reason":"<pourquoi>"}],
  "top_stocks": [{"symbol":"<ticker réel avec suffixe bourse ex: MC.PA, 005930.KS>","name":"<nom>","sector":"<secteur>","reason":"<pourquoi>","estimated_growth":"<% attendu>"}],
  "news_summary": "<résumé actualité éco/géo, impact CT/MT/LT>",
  "score_explanation": "<explication des notes>"
}

Sois précis avec des données réelles. Les tickers doivent inclure le suffixe de la bourse (ex: .PA pour Paris, .L pour Londres, .KS pour Séoul, .T pour Tokyo). Les 5 meilleures actions doivent être des vrais tickers cotés dans ce pays.`;

  try {
    const raw = await askClaude(prompt, 3000);
    const data = extractJSON(raw);
    if (data) {
      data.overall_score = Math.round((
        (data.macro_score || 0) * 0.3 +
        (data.geo_score || 0) * 0.25 +
        (data.micro_score || 0) * 0.2 +
        (data.sentiment_score || 0) * 0.25
      ) * 10) / 10;
      data.updated_at = new Date().toLocaleString('fr-FR');
      storage.set(`country_${countryCode}`, data);
    }
    return data;
  } catch (e) {
    console.error(`Country analysis failed for ${countryCode}:`, e);
    return null;
  }
}

export async function fetchStockAnalysis(symbol, companyName, countryName) {
  const cached = storage.get(`stock_${symbol}`);
  if (cached) return cached;

  const prompt = `Tu es un analyste financier quantitatif professionnel. Analyse l'action "${symbol}" (${companyName}) cotée en ${countryName} pour un investisseur en février 2026.

RÉPONDS UNIQUEMENT en JSON valide sans markdown :
{
  "price": <cours actuel>,
  "currency": "<devise>",
  "per": <PER>,
  "peg": <PEG ratio>,
  "payout_ratio": <payout ratio %>,
  "roic_wacc": <ROIC - WACC spread>,
  "debt_assets": <dette/actifs %>,
  "leverage": <levier financier>,
  "net_margin_evolution": "<tendance marge nette 3 ans>",
  "sharpe_ratio": <ratio de Sharpe>,
  "estimated_growth": <estimation hausse cours %>,
  "tp": <take profit>,
  "sl": <stop loss>,
  "tp_probability": <probabilité TP %>,
  "sl_probability": <probabilité SL %>,
  "gain_pct": <gain potentiel %>,
  "loss_pct": <perte potentielle %>,
  "gain_loss_ratio": <ratio gain/perte>,
  "estimated_days": <jours estimés pour atteindre TP>,
  "annual_volatility": <volatilité annualisée ex: 0.30 pour 30%>,
  "next_dividend_date": "<date prochain dividende>",
  "next_dividend_pct": <rendement dividende %>,
  "fundamental_analysis": "<analyse fondamentale détaillée>",
  "technical_analysis": "<analyse technique détaillée>",
  "tp_sl_explanation": "<explication TP/SL et probabilités>",
  "news_summary": "<actualités récentes et impact>",
  "overall_rating": <note /10>,
  "rating_explanation": "<pourquoi cette note>"
}

Pour le TP : niveau ayant >66% de proba basé sur analyse technique (ATR, supports, résistances, volatilité historique).
Pour le SL : niveau ayant <33% de proba d'être atteint. Maximise le ratio gain/perte. Données réelles actuelles.`;

  try {
    const raw = await askClaude(prompt, 3000);
    const data = extractJSON(raw);
    if (data) {
      data.updated_at = new Date().toLocaleString('fr-FR');
      storage.set(`stock_${symbol}`, data, 12 * 60 * 60 * 1000); // 12h TTL
    }
    return data;
  } catch (e) {
    console.error(`Stock analysis failed for ${symbol}:`, e);
    return null;
  }
}

export async function searchStocks(query) {
  if (!query || query.length < 2) return [];

  const cacheKey = `search_${query.toLowerCase().trim()}`;
  const cached = storage.get(cacheKey);
  if (cached) return cached;

  const prompt = `Recherche les actions correspondant à "${query}" comme sur Interactive Brokers.
Réponds UNIQUEMENT en JSON valide :
[{"symbol":"<TICKER réel avec suffixe bourse: AAPL pour NASDAQ, MC.PA pour Euronext Paris, BAYN.DE pour Xetra, 7203.T pour Tokyo, etc.>","name":"<Nom complet de l'entreprise>","sector":"<Secteur>","country":"<Pays>","countryCode":"<Code ISO 2 lettres>","exchange":"<Bourse: NASDAQ, NYSE, Euronext, LSE, Xetra, TSE, etc.>"}]
Donne jusqu'à 8 résultats pertinents. Utilise les vrais formats de ticker IBKR. Si c'est un nom d'entreprise, donne le ticker. Si c'est un ticker, donne les variantes sur différentes bourses.`;

  try {
    const raw = await askClaude(prompt, 1500);
    const results = extractJSON(raw) || [];
    if (results.length) storage.set(cacheKey, results, 60 * 60 * 1000); // 1h TTL
    return results;
  } catch { return []; }
}

export async function fetchAISuggestedTPSL(symbol, currentPrice, avgCost, quantity) {
  const prompt = `Tu es un analyste quantitatif professionnel. Pour l'action ${symbol} au prix actuel de ${currentPrice}, avec un PRU de ${avgCost} et ${quantity} actions, analyse en profondeur et suggère de nouveaux TP et SL optimaux.

Réponds en JSON valide sans markdown:
{
  "suggested_tp": <nouveau take profit optimisé>,
  "suggested_sl": <nouveau stop loss optimisé>,
  "tp_probability": <probabilité % d'atteindre le TP>,
  "sl_probability": <probabilité % de toucher le SL>,
  "gain_loss_ratio": <ratio gain/perte>,
  "reasoning": "<explication détaillée basée sur: volatilité historique et ATR, niveaux supports/résistances clés, tendance momentum, analyse fondamentale, contexte macro>"
}

Base ton analyse sur les données actuelles. Maximise le ratio gain/perte tout en gardant un TP réaliste (>60% de proba) et un SL protecteur (<30% de proba d'être atteint).`;

  try {
    const raw = await askClaude(prompt, 2000);
    return extractJSON(raw);
  } catch { return null; }
}

export async function fetchCurrentPrice(symbol) {
  const prompt = `Quel est le cours actuel de l'action ${symbol} ? Réponds UNIQUEMENT en JSON: {"price": <nombre>, "currency": "<devise>"}`;
  try {
    const raw = await askClaude(prompt, 500);
    return extractJSON(raw);
  } catch { return null; }
}
