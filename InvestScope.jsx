import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// INVESTSCOPE — Application d'Analyse d'Investissement Mondiale
// ═══════════════════════════════════════════════════════════════

// Constantes PEA (Espace Économique Européen + quelques exceptions)
const PEA_COUNTRIES = [
  "FR","DE","IT","ES","PT","NL","BE","AT","FI","IE","GR","LU","MT","CY","SK","SI","EE","LV","LT",
  "SE","DK","NO","IS","PL","CZ","HU","RO","BG","HR","LI","GB"
];

// Données de référence des pays avec marchés boursiers actifs
const COUNTRY_DATA = [
  { code: "KR", name: "Corée du Sud", flag: "🇰🇷", region: "Asie" },
  { code: "IN", name: "Inde", flag: "🇮🇳", region: "Asie" },
  { code: "ID", name: "Indonésie", flag: "🇮🇩", region: "Asie" },
  { code: "MY", name: "Malaisie", flag: "🇲🇾", region: "Asie" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", region: "Asie" },
  { code: "TH", name: "Thaïlande", flag: "🇹🇭", region: "Asie" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", region: "Asie" },
  { code: "CN", name: "Chine", flag: "🇨🇳", region: "Asie" },
  { code: "JP", name: "Japon", flag: "🇯🇵", region: "Asie" },
  { code: "TW", name: "Taïwan", flag: "🇹🇼", region: "Asie" },
  { code: "SG", name: "Singapour", flag: "🇸🇬", region: "Asie" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", region: "Asie" },
  { code: "US", name: "États-Unis", flag: "🇺🇸", region: "Amérique" },
  { code: "BR", name: "Brésil", flag: "🇧🇷", region: "Amérique" },
  { code: "MX", name: "Mexique", flag: "🇲🇽", region: "Amérique" },
  { code: "AR", name: "Argentine", flag: "🇦🇷", region: "Amérique" },
  { code: "CL", name: "Chili", flag: "🇨🇱", region: "Amérique" },
  { code: "CO", name: "Colombie", flag: "🇨🇴", region: "Amérique" },
  { code: "PE", name: "Pérou", flag: "🇵🇪", region: "Amérique" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧", region: "Europe" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪", region: "Europe" },
  { code: "FR", name: "France", flag: "🇫🇷", region: "Europe" },
  { code: "SE", name: "Suède", flag: "🇸🇪", region: "Europe" },
  { code: "NO", name: "Norvège", flag: "🇳🇴", region: "Europe" },
  { code: "DK", name: "Danemark", flag: "🇩🇰", region: "Europe" },
  { code: "FI", name: "Finlande", flag: "🇫🇮", region: "Europe" },
  { code: "NL", name: "Pays-Bas", flag: "🇳🇱", region: "Europe" },
  { code: "BE", name: "Belgique", flag: "🇧🇪", region: "Europe" },
  { code: "IT", name: "Italie", flag: "🇮🇹", region: "Europe" },
  { code: "ES", name: "Espagne", flag: "🇪🇸", region: "Europe" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", region: "Europe" },
  { code: "GR", name: "Grèce", flag: "🇬🇷", region: "Europe" },
  { code: "PL", name: "Pologne", flag: "🇵🇱", region: "Europe" },
  { code: "CZ", name: "Tchéquie", flag: "🇨🇿", region: "Europe" },
  { code: "HU", name: "Hongrie", flag: "🇭🇺", region: "Europe" },
  { code: "RO", name: "Roumanie", flag: "🇷🇴", region: "Europe" },
  { code: "BG", name: "Bulgarie", flag: "🇧🇬", region: "Europe" },
  { code: "HR", name: "Croatie", flag: "🇭🇷", region: "Europe" },
  { code: "RS", name: "Serbie", flag: "🇷🇸", region: "Europe" },
  { code: "TR", name: "Turquie", flag: "🇹🇷", region: "Europe" },
  { code: "AT", name: "Autriche", flag: "🇦🇹", region: "Europe" },
  { code: "CH", name: "Suisse", flag: "🇨🇭", region: "Europe" },
  { code: "IE", name: "Irlande", flag: "🇮🇪", region: "Europe" },
  { code: "AU", name: "Australie", flag: "🇦🇺", region: "Océanie" },
  { code: "NZ", name: "Nouvelle-Zélande", flag: "🇳🇿", region: "Océanie" },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦", region: "Afrique" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", region: "Afrique" },
  { code: "EG", name: "Égypte", flag: "🇪🇬", region: "Afrique" },
  { code: "MA", name: "Maroc", flag: "🇲🇦", region: "Afrique" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", region: "Afrique" },
  { code: "SA", name: "Arabie Saoudite", flag: "🇸🇦", region: "Moyen-Orient" },
  { code: "AE", name: "Émirats Arabes Unis", flag: "🇦🇪", region: "Moyen-Orient" },
  { code: "QA", name: "Qatar", flag: "🇶🇦", region: "Moyen-Orient" },
  { code: "IL", name: "Israël", flag: "🇮🇱", region: "Moyen-Orient" },
  { code: "RU", name: "Russie", flag: "🇷🇺", region: "Europe" },
];

// ─── Helpers ────────────────────────────────────────────────
const cycleColors = { "Expansion": "#22c55e", "Pic": "#f59e0b", "Récession": "#ef4444", "Rebond": "#3b82f6" };
const cycleIcons = { "Expansion": "📈", "Pic": "🔝", "Récession": "📉", "Rebond": "🔄" };

function ScoreBadge({ score, label }) {
  const color = score >= 7.5 ? "#22c55e" : score >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%", display: "flex",
        alignItems: "center", justifyContent: "center", margin: "0 auto 4px",
        background: `conic-gradient(${color} ${score * 36}deg, #1e293b ${score * 36}deg)`,
        position: "relative"
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#0f172a",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color
        }}>{score?.toFixed(1)}</div>
      </div>
      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function CycleBadge({ cycle, phase }) {
  const c = cycleColors[cycle] || "#64748b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        background: c + "22", color: c, padding: "3px 10px", borderRadius: 12,
        fontSize: 12, fontWeight: 600, border: `1px solid ${c}44`
      }}>
        {cycleIcons[cycle]} {cycle}
      </span>
      {phase != null && (
        <div style={{ position: "relative", width: 50, height: 6, background: "#1e293b", borderRadius: 3 }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: 6, borderRadius: 3,
            width: `${phase}%`, background: c
          }} />
          <span style={{ position: "absolute", top: -14, left: `${Math.min(phase, 90)}%`, fontSize: 9, color: c }}>
            {phase?.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

function SignalBadge({ signal }) {
  const map = {
    "ACHETER FORT": { bg: "#15803d", color: "#bbf7d0" },
    "ACHETER": { bg: "#166534", color: "#86efac" },
    "CONSERVER": { bg: "#854d0e", color: "#fde68a" },
    "VENDRE": { bg: "#991b1b", color: "#fca5a5" },
    "VENDRE FORT": { bg: "#7f1d1d", color: "#fecaca" },
  };
  const s = map[signal] || { bg: "#334155", color: "#cbd5e1" };
  return (
    <span style={{
      background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 6,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5
    }}>{signal}</span>
  );
}

function LoadingSpinner({ text }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
      <div style={{
        width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #3b82f6",
        borderRadius: "50%", animation: "spin 1s linear infinite"
      }} />
      <p style={{ color: "#94a3b8", fontSize: 13 }}>{text || "Chargement..."}</p>
    </div>
  );
}

// ─── API Helper ─────────────────────────────────────────────
async function askClaude(prompt, maxTokens = 4000) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    return data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
  } catch (e) {
    console.error("API Error:", e);
    return null;
  }
}

async function fetchCountryAnalysis(countryName, countryCode) {
  const prompt = `Tu es un analyste financier professionnel. Analyse le pays "${countryName}" (${countryCode}) pour l'investissement boursier en février 2026. Utilise des données réelles et actuelles.

RÉPONDS UNIQUEMENT en JSON valide, sans markdown, sans backticks. Format exact :
{
  "macro_score": <note/10 basée sur PIB, inflation, taux, emploi>,
  "geo_score": <note/10 risques géopolitiques, stabilité, sanctions>,
  "micro_score": <note/10 environnement des affaires, réglementation, investissement étranger>,
  "sentiment_score": <note/10 flux de capitaux, sentiment marché, spéculation>,
  "cycle": "<Expansion|Pic|Récession|Rebond>",
  "cycle_phase": <0.01 à 99.99 - position dans le cycle>,
  "cycle_explanation": "<explication de 2-3 phrases sur pourquoi ce cycle et cette phase>",
  "central_bank_rate": <taux directeur actuel>,
  "unemployment": <taux de chômage>,
  "gdp_growth_5y": [<5 dernières années de croissance PIB>],
  "pmi_manufacturing": <PMI manufacturier>,
  "pmi_services": <PMI services>,
  "inflation_cpi": <inflation CPI annuelle>,
  "inflation_core": <inflation core>,
  "sectors_buy": [{"name":"<secteur précis>","signal":"<ACHETER FORT|ACHETER>","reason":"<pourquoi>"}],
  "sectors_sell": [{"name":"<secteur>","signal":"<VENDRE|VENDRE FORT>","reason":"<pourquoi>"}],
  "top_stocks": [{"symbol":"<ticker>","name":"<nom>","sector":"<secteur>","reason":"<pourquoi ce choix>","estimated_growth":"<% attendu>"}],
  "news_summary": "<résumé actualité éco/géo du pays, impact CT/MT/LT>",
  "score_explanation": "<explication des notes attribuées>"
}

Sois précis avec des données réelles. Les secteurs doivent être spécifiques (ex: "Semi-conducteurs mémoire HBM" pas juste "Tech"). Les 5 meilleures actions doivent être des vrais tickers cotés dans ce pays.`;

  const raw = await askClaude(prompt, 3000);
  if (!raw) return null;
  try {
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace === -1) return null;
    return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
  } catch (e) {
    console.error("Parse error:", e, raw?.substring(0, 200));
    return null;
  }
}

async function fetchStockAnalysis(symbol, companyName, countryName) {
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
  "tp": <take profit - proba >66% d'être atteint>,
  "sl": <stop loss - proba <33% d'être atteint>,
  "tp_probability": <probabilité TP %>,
  "sl_probability": <probabilité SL %>,
  "gain_pct": <gain potentiel %>,
  "loss_pct": <perte potentielle %>,
  "gain_loss_ratio": <ratio gain/perte>,
  "estimated_days": <jours estimés pour atteindre TP>,
  "next_dividend_date": "<date prochain dividende>",
  "next_dividend_pct": <rendement dividende %>,
  "fundamental_analysis": "<analyse fondamentale détaillée>",
  "technical_analysis": "<analyse technique détaillée avec supports/résistances/indicateurs>",
  "tp_sl_explanation": "<explication de comment tu as déterminé TP et SL et leurs probabilités>",
  "news_summary": "<actualités récentes sur l'action et impact CT/MT/LT>",
  "overall_rating": <note /10>,
  "rating_explanation": "<pourquoi cette note>"
}

Pour le TP : trouve le niveau ayant >66% de probabilité d'être atteint basé sur l'analyse technique (supports, résistances, volatilité historique, ATR).
Pour le SL : trouve le niveau ayant <33% de probabilité d'être atteint.
Maximise le ratio gain/perte possible. Utilise des données réelles actuelles.`;

  const raw = await askClaude(prompt, 3000);
  if (!raw) return null;
  try {
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace === -1) return null;
    return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS PRINCIPAUX
// ═══════════════════════════════════════════════════════════════

// ─── Navigation ─────────────────────────────────────────────
function NavBar({ view, setView, searchQuery, setSearchQuery }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100, background: "#0a0f1e",
      borderBottom: "1px solid #1e293b", backdropFilter: "blur(20px)"
    }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6", letterSpacing: -1 }}>
          📊 InvestScope
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="🔍 Rechercher un pays ou une action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "8px 14px", borderRadius: 10,
              background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0",
              fontSize: 13, outline: "none"
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 0, borderTop: "1px solid #1e293b" }}>
        {[
          { id: "countries", icon: "🌍", label: "Pays" },
          { id: "watchlists", icon: "⭐", label: "Listes" },
          { id: "search", icon: "🔎", label: "Analyser" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            flex: 1, padding: "10px 0", background: view === tab.id ? "#1e293b" : "transparent",
            border: "none", borderBottom: view === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
            color: view === tab.id ? "#3b82f6" : "#64748b", cursor: "pointer",
            fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2
          }}>
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Liste des Pays ─────────────────────────────────────────
function CountryList({ countries, onSelect, filter, setFilter, searchQuery, loading }) {
  const filtered = countries
    .filter(c => {
      if (filter === "pea" && !PEA_COUNTRIES.includes(c.code)) return false;
      if (filter === "horspea" && PEA_COUNTRIES.includes(c.code)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));

  return (
    <div style={{ padding: "0 12px 80px" }}>
      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, padding: "12px 0", overflowX: "auto" }}>
        {[
          { id: "all", label: "Tous" },
          { id: "pea", label: "🇪🇺 PEA" },
          { id: "horspea", label: "🌏 Hors PEA" },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 14px", borderRadius: 20, border: "1px solid",
            borderColor: filter === f.id ? "#3b82f6" : "#334155",
            background: filter === f.id ? "#3b82f622" : "transparent",
            color: filter === f.id ? "#3b82f6" : "#94a3b8",
            fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
          }}>{f.label}</button>
        ))}
      </div>

      {loading && <LoadingSpinner text="Analyse des marchés mondiaux en cours..." />}

      {/* Liste */}
      {filtered.map((country, idx) => (
        <button key={country.code} onClick={() => onSelect(country)} style={{
          width: "100%", padding: "14px", marginBottom: 8, borderRadius: 12,
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          border: "1px solid #1e293b", cursor: "pointer", textAlign: "left",
          transition: "all 0.2s"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Rang */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: idx < 3 ? "#3b82f622" : "#1e293b",
              color: idx < 3 ? "#3b82f6" : "#64748b", fontSize: 12, fontWeight: 700
            }}>
              {idx + 1}
            </div>
            {/* Drapeau + Nom */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 20 }}>{country.flag}</span>
                <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{country.name}</span>
                {PEA_COUNTRIES.includes(country.code) && (
                  <span style={{
                    fontSize: 8, background: "#3b82f622", color: "#60a5fa",
                    padding: "1px 5px", borderRadius: 4, fontWeight: 700
                  }}>PEA</span>
                )}
              </div>
              {country.cycle && (
                <div style={{ marginTop: 4 }}>
                  <CycleBadge cycle={country.cycle} phase={country.cycle_phase} />
                </div>
              )}
            </div>
            {/* Scores */}
            {country.overall_score != null && (
              <div style={{ display: "flex", gap: 6 }}>
                <ScoreBadge score={country.macro_score} label="Macro" />
                <ScoreBadge score={country.geo_score} label="Géo" />
                <ScoreBadge score={country.sentiment_score} label="Sent." />
              </div>
            )}
            {/* Score global */}
            {country.overall_score != null && (
              <div style={{
                fontSize: 20, fontWeight: 800,
                color: country.overall_score >= 7 ? "#22c55e" : country.overall_score >= 5 ? "#f59e0b" : "#ef4444"
              }}>
                {country.overall_score.toFixed(1)}
              </div>
            )}
          </div>
        </button>
      ))}

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          Aucun pays trouvé. Cliquez sur "Actualiser" pour charger les analyses.
        </div>
      )}
    </div>
  );
}

// ─── Détail d'un Pays ───────────────────────────────────────
function CountryDetail({ country, onBack, onSelectStock, loading }) {
  return (
    <div style={{ padding: "0 12px 80px" }}>
      {/* Header */}
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{
          background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8,
          padding: "8px 12px", cursor: "pointer", fontSize: 16
        }}>←</button>
        <span style={{ fontSize: 28 }}>{country.flag}</span>
        <div>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 18 }}>{country.name}</h2>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {PEA_COUNTRIES.includes(country.code) && (
              <span style={{ fontSize: 10, background: "#3b82f622", color: "#60a5fa", padding: "2px 6px", borderRadius: 4 }}>PEA ✓</span>
            )}
            <span style={{ fontSize: 10, color: "#64748b" }}>Maj: {country.updated_at || "—"}</span>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner text={`Analyse approfondie de ${country.name}...`} /> : (
        <>
          {/* Scores */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16
          }}>
            {[
              { s: country.macro_score, l: "Macro" },
              { s: country.geo_score, l: "Géopolitique" },
              { s: country.micro_score, l: "Micro" },
              { s: country.sentiment_score, l: "Sentiment" },
            ].map((item, i) => (
              <div key={i} style={{
                background: "#0f172a", borderRadius: 10, padding: 12, textAlign: "center",
                border: "1px solid #1e293b"
              }}>
                <ScoreBadge score={item.s} label={item.l} />
              </div>
            ))}
          </div>

          {/* Cycle */}
          {country.cycle && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>CYCLE ÉCONOMIQUE</div>
              <CycleBadge cycle={country.cycle} phase={country.cycle_phase} />
              {country.cycle_explanation && (
                <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  {country.cycle_explanation}
                </p>
              )}
            </div>
          )}

          {/* Données macro */}
          <div style={{
            background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
            border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>INDICATEURS MACROÉCONOMIQUES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {[
                { label: "Taux directeur", value: country.central_bank_rate != null ? `${country.central_bank_rate}%` : "—" },
                { label: "Chômage", value: country.unemployment != null ? `${country.unemployment}%` : "—" },
                { label: "Inflation CPI", value: country.inflation_cpi != null ? `${country.inflation_cpi}%` : "—" },
                { label: "Inflation core", value: country.inflation_core != null ? `${country.inflation_core}%` : "—" },
                { label: "PMI Manuf.", value: country.pmi_manufacturing || "—" },
                { label: "PMI Services", value: country.pmi_services || "—" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e293b11" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{item.label}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {country.gdp_growth_5y && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>PIB 5 dernières années</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {(Array.isArray(country.gdp_growth_5y) ? country.gdp_growth_5y : []).map((g, i) => (
                    <div key={i} style={{
                      flex: 1, textAlign: "center", padding: 6, borderRadius: 6,
                      background: g >= 0 ? "#22c55e11" : "#ef444411",
                      color: g >= 0 ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 600
                    }}>{typeof g === "number" ? `${g > 0 ? "+" : ""}${g}%` : g}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secteurs */}
          <div style={{
            background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
            border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>SECTEURS À PRIVILÉGIER</div>
            {(country.sectors_buy || []).map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                borderBottom: i < (country.sectors_buy?.length || 0) - 1 ? "1px solid #1e293b" : "none"
              }}>
                <SignalBadge signal={s.signal} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{s.reason}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 14, marginBottom: 10, fontWeight: 600 }}>SECTEURS À ÉVITER</div>
            {(country.sectors_sell || []).map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                borderBottom: i < (country.sectors_sell?.length || 0) - 1 ? "1px solid #1e293b" : "none"
              }}>
                <SignalBadge signal={s.signal} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{s.reason}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Top 5 actions */}
          <div style={{
            background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
            border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>TOP 5 ACTIONS RECOMMANDÉES</div>
            {(country.top_stocks || []).map((stock, i) => (
              <button key={i} onClick={() => onSelectStock(stock)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 8px", background: i % 2 === 0 ? "#1e293b33" : "transparent",
                border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left"
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, background: "#3b82f622",
                  color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700
                }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{stock.symbol}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{stock.name} • {stock.sector}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>
                    +{stock.estimated_growth}
                  </div>
                </div>
                <span style={{ color: "#3b82f6", fontSize: 16 }}>›</span>
              </button>
            ))}
          </div>

          {/* Actualités */}
          {country.news_summary && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>📰 ACTUALITÉ & IMPACT</div>
              <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {country.news_summary}
              </p>
            </div>
          )}

          {/* Explication des notes */}
          {country.score_explanation && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>💡 JUSTIFICATION DES NOTES</div>
              <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {country.score_explanation}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Détail d'une Action ────────────────────────────────────
function StockDetail({ stock, onBack, loading }) {
  return (
    <div style={{ padding: "0 12px 80px" }}>
      <div style={{ padding: "16px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{
          background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: 8,
          padding: "8px 12px", cursor: "pointer", fontSize: 16
        }}>←</button>
        <div>
          <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 18 }}>{stock.symbol}</h2>
          <div style={{ color: "#64748b", fontSize: 12 }}>{stock.name}</div>
        </div>
        {stock.price && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700 }}>
              {stock.price} {stock.currency}
            </div>
            <span style={{ fontSize: 10, color: "#64748b" }}>Maj: {stock.updated_at || "—"}</span>
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner text={`Analyse de ${stock.symbol}...`} /> : (
        <>
          {/* TP / SL */}
          {stock.tp && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12
            }}>
              <div style={{
                background: "#22c55e11", border: "1px solid #22c55e33", borderRadius: 12, padding: 14
              }}>
                <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>🎯 TAKE PROFIT</div>
                <div style={{ fontSize: 22, color: "#22c55e", fontWeight: 800 }}>{stock.tp} {stock.currency}</div>
                <div style={{ fontSize: 11, color: "#86efac" }}>+{stock.gain_pct}% • Proba: {stock.tp_probability}%</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>~{stock.estimated_days}j estimés</div>
              </div>
              <div style={{
                background: "#ef444411", border: "1px solid #ef444433", borderRadius: 12, padding: 14
              }}>
                <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>🛑 STOP LOSS</div>
                <div style={{ fontSize: 22, color: "#ef4444", fontWeight: 800 }}>{stock.sl} {stock.currency}</div>
                <div style={{ fontSize: 11, color: "#fca5a5" }}>{stock.loss_pct}% • Proba: {stock.sl_probability}%</div>
              </div>
            </div>
          )}

          {/* Ratio gain/perte */}
          {stock.gain_loss_ratio && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b", textAlign: "center"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>RATIO GAIN/PERTE</div>
              <div style={{
                fontSize: 28, fontWeight: 800,
                color: stock.gain_loss_ratio >= 2 ? "#22c55e" : stock.gain_loss_ratio >= 1 ? "#f59e0b" : "#ef4444"
              }}>{stock.gain_loss_ratio?.toFixed(2)}x</div>
            </div>
          )}

          {/* Dividende */}
          {stock.next_dividend_date && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>💰 PROCHAIN DIVIDENDE</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#e2e8f0", fontSize: 13 }}>{stock.next_dividend_date}</span>
                <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>{stock.next_dividend_pct}%</span>
              </div>
            </div>
          )}

          {/* Analyse fondamentale */}
          <div style={{
            background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
            border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>📊 ANALYSE FONDAMENTALE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: "PER", value: stock.per },
                { label: "PEG", value: stock.peg },
                { label: "Payout Ratio", value: stock.payout_ratio ? `${stock.payout_ratio}%` : null },
                { label: "ROIC-WACC", value: stock.roic_wacc ? `${stock.roic_wacc}%` : null },
                { label: "Dettes/Actifs", value: stock.debt_assets ? `${stock.debt_assets}%` : null },
                { label: "Levier", value: stock.leverage ? `${stock.leverage}x` : null },
                { label: "Sharpe", value: stock.sharpe_ratio },
              ].filter(x => x.value != null).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{item.label}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {stock.net_margin_evolution && (
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                <strong style={{ color: "#64748b" }}>Marge nette:</strong> {stock.net_margin_evolution}
              </div>
            )}
            {stock.fundamental_analysis && (
              <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {stock.fundamental_analysis}
              </p>
            )}
          </div>

          {/* Analyse technique */}
          {stock.technical_analysis && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>📈 ANALYSE TECHNIQUE</div>
              <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {stock.technical_analysis}
              </p>
            </div>
          )}

          {/* Explication TP/SL */}
          {stock.tp_sl_explanation && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>🎯 MÉTHODOLOGIE TP/SL</div>
              <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {stock.tp_sl_explanation}
              </p>
            </div>
          )}

          {/* Actualités */}
          {stock.news_summary && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>📰 ACTUALITÉS & IMPACT</div>
              <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                {stock.news_summary}
              </p>
            </div>
          )}

          {/* Note globale et explication */}
          {stock.overall_rating != null && (
            <div style={{
              background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 12,
              border: "1px solid #1e293b"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>📋 NOTE GLOBALE</div>
                <ScoreBadge score={stock.overall_rating} label="" />
              </div>
              {stock.rating_explanation && (
                <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                  {stock.rating_explanation}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Watchlists ─────────────────────────────────────────────
function WatchlistView({ onSelectStock }) {
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [selectedList, setSelectedList] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("watchlists");
        if (result?.value) setLists(JSON.parse(result.value));
      } catch (e) { /* empty */ }
    })();
  }, []);

  const saveLists = async (updated) => {
    setLists(updated);
    await window.storage.set("watchlists", JSON.stringify(updated));
  };

  const addList = () => {
    if (!newListName.trim()) return;
    saveLists([...lists, { name: newListName.trim(), items: [] }]);
    setNewListName("");
  };

  const removeList = (idx) => {
    saveLists(lists.filter((_, i) => i !== idx));
    if (selectedList === idx) setSelectedList(null);
  };

  const addSymbol = () => {
    if (!newSymbol.trim() || selectedList == null) return;
    const updated = [...lists];
    updated[selectedList].items.push({
      symbol: newSymbol.trim().toUpperCase(),
      addedAt: new Date().toISOString()
    });
    saveLists(updated);
    setNewSymbol("");
  };

  const removeSymbol = (listIdx, symIdx) => {
    const updated = [...lists];
    updated[listIdx].items.splice(symIdx, 1);
    saveLists(updated);
  };

  return (
    <div style={{ padding: "12px 12px 80px" }}>
      <h3 style={{ color: "#e2e8f0", marginBottom: 12 }}>⭐ Mes Listes de Surveillance</h3>

      {/* Créer une liste */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
          placeholder="Nouvelle liste..."
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8, background: "#1e293b",
            border: "1px solid #334155", color: "#e2e8f0", fontSize: 13
          }}
        />
        <button onClick={addList} style={{
          padding: "8px 16px", borderRadius: 8, background: "#3b82f6",
          border: "none", color: "white", fontWeight: 600, cursor: "pointer"
        }}>+</button>
      </div>

      {/* Listes */}
      {lists.map((list, idx) => (
        <div key={idx} style={{
          background: "#0f172a", borderRadius: 12, padding: 14, marginBottom: 10,
          border: selectedList === idx ? "1px solid #3b82f6" : "1px solid #1e293b"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => setSelectedList(selectedList === idx ? null : idx)} style={{
              background: "none", border: "none", color: "#e2e8f0", fontSize: 14,
              fontWeight: 600, cursor: "pointer", padding: 0
            }}>
              {selectedList === idx ? "▾" : "▸"} {list.name} ({list.items.length})
            </button>
            <button onClick={() => removeList(idx)} style={{
              background: "#ef444422", border: "none", color: "#ef4444", borderRadius: 6,
              padding: "4px 8px", cursor: "pointer", fontSize: 11
            }}>Supprimer</button>
          </div>

          {selectedList === idx && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  placeholder="Ajouter un ticker (ex: AAPL)..."
                  onKeyDown={e => e.key === "Enter" && addSymbol()}
                  style={{
                    flex: 1, padding: "6px 10px", borderRadius: 6, background: "#1e293b",
                    border: "1px solid #334155", color: "#e2e8f0", fontSize: 12
                  }}
                />
                <button onClick={addSymbol} style={{
                  padding: "6px 12px", borderRadius: 6, background: "#22c55e33",
                  border: "none", color: "#22c55e", cursor: "pointer", fontSize: 12
                }}>Ajouter</button>
              </div>

              {list.items.map((item, si) => (
                <div key={si} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid #1e293b"
                }}>
                  <button onClick={() => onSelectStock({ symbol: item.symbol, name: item.symbol })} style={{
                    background: "none", border: "none", color: "#3b82f6", cursor: "pointer",
                    fontWeight: 600, fontSize: 13, padding: 0
                  }}>{item.symbol}</button>
                  <button onClick={() => removeSymbol(idx, si)} style={{
                    background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14
                  }}>✕</button>
                </div>
              ))}
            </>
          )}
        </div>
      ))}

      {lists.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: "#64748b", fontSize: 13 }}>
          Créez une liste pour suivre vos actions favorites
        </div>
      )}
    </div>
  );
}

// ─── Recherche d'actions ────────────────────────────────────
function SearchView({ onSelectStock }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const prompt = `Recherche les informations sur l'action ou ticker "${query}". Réponds UNIQUEMENT en JSON valide :
[{"symbol":"<TICKER>","name":"<Nom complet>","sector":"<Secteur>","country":"<Pays>","exchange":"<Bourse>","price":"<prix actuel approximatif>"}]
Si c'est un nom d'entreprise, donne le ticker. Donne jusqu'à 5 résultats pertinents.`;
    const raw = await askClaude(prompt, 1000);
    try {
      const jsonStr = raw?.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const first = jsonStr?.indexOf("[");
      const last = jsonStr?.lastIndexOf("]");
      if (first >= 0) setResults(JSON.parse(jsonStr.substring(first, last + 1)));
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  return (
    <div style={{ padding: "12px 12px 80px" }}>
      <h3 style={{ color: "#e2e8f0", marginBottom: 12 }}>🔎 Analyser une Action</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Ticker ou nom d'entreprise..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10, background: "#1e293b",
            border: "1px solid #334155", color: "#e2e8f0", fontSize: 14
          }}
        />
        <button onClick={search} disabled={searching} style={{
          padding: "10px 20px", borderRadius: 10, background: "#3b82f6",
          border: "none", color: "white", fontWeight: 600, cursor: "pointer"
        }}>{searching ? "..." : "Chercher"}</button>
      </div>

      {searching && <LoadingSpinner text="Recherche en cours..." />}

      {results.map((r, i) => (
        <button key={i} onClick={() => onSelectStock(r)} style={{
          width: "100%", padding: 14, marginBottom: 8, borderRadius: 10,
          background: "#0f172a", border: "1px solid #1e293b", cursor: "pointer",
          textAlign: "left", display: "flex", alignItems: "center", gap: 12
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>{r.symbol}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{r.name} • {r.sector} • {r.country}</div>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{r.exchange}</div>
          <span style={{ color: "#3b82f6", fontSize: 18 }}>›</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION PRINCIPALE
// ═══════════════════════════════════════════════════════════════
export default function InvestScopeApp() {
  const [view, setView] = useState("countries");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [countries, setCountries] = useState(COUNTRY_DATA.map(c => ({ ...c, overall_score: null })));
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockFrom, setStockFrom] = useState(null); // "country" ou "search"
  const [loading, setLoading] = useState(false);
  const [countryLoading, setCountryLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Charger cache au démarrage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("countries_cache");
        if (result?.value) {
          const cached = JSON.parse(result.value);
          setCountries(prev => prev.map(c => {
            const found = cached.find(x => x.code === c.code);
            return found ? { ...c, ...found } : c;
          }));
        }
      } catch (e) { /* premier lancement */ }
      setInitialized(true);
    })();
  }, []);

  // Analyser les pays (batch par 5)
  const refreshCountries = useCallback(async () => {
    setLoading(true);
    const toAnalyze = countries.filter(c => !c.overall_score);
    const batchSize = 3;

    for (let i = 0; i < Math.min(toAnalyze.length, 15); i += batchSize) {
      const batch = toAnalyze.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(c => fetchCountryAnalysis(c.name, c.code))
      );

      setCountries(prev => {
        const updated = [...prev];
        batch.forEach((c, j) => {
          if (results[j]) {
            const idx = updated.findIndex(x => x.code === c.code);
            if (idx >= 0) {
              const data = results[j];
              const overall = (
                (data.macro_score || 0) * 0.3 +
                (data.geo_score || 0) * 0.25 +
                (data.micro_score || 0) * 0.2 +
                (data.sentiment_score || 0) * 0.25
              );
              updated[idx] = {
                ...updated[idx], ...data,
                overall_score: Math.round(overall * 10) / 10,
                updated_at: new Date().toLocaleString("fr-FR")
              };
            }
          }
        });
        // Sauvegarder cache
        window.storage.set("countries_cache", JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    }
    setLoading(false);
  }, [countries]);

  // Charger détails pays
  const selectCountry = async (country) => {
    setSelectedCountry(country);
    setView("countryDetail");
    if (!country.sectors_buy) {
      setCountryLoading(true);
      const data = await fetchCountryAnalysis(country.name, country.code);
      if (data) {
        const overall = (
          (data.macro_score || 0) * 0.3 +
          (data.geo_score || 0) * 0.25 +
          (data.micro_score || 0) * 0.2 +
          (data.sentiment_score || 0) * 0.25
        );
        const updated = { ...country, ...data, overall_score: Math.round(overall * 10) / 10, updated_at: new Date().toLocaleString("fr-FR") };
        setSelectedCountry(updated);
        setCountries(prev => {
          const list = prev.map(c => c.code === country.code ? updated : c);
          window.storage.set("countries_cache", JSON.stringify(list)).catch(() => {});
          return list;
        });
      }
      setCountryLoading(false);
    }
  };

  // Charger détails action
  const selectStock = async (stock, from = "country") => {
    setSelectedStock(stock);
    setStockFrom(from);
    setView("stockDetail");
    if (!stock.fundamental_analysis) {
      setStockLoading(true);
      const data = await fetchStockAnalysis(
        stock.symbol,
        stock.name,
        selectedCountry?.name || stock.country || "Mondial"
      );
      if (data) {
        setSelectedStock(prev => ({
          ...prev, ...data,
          updated_at: new Date().toLocaleString("fr-FR")
        }));
      }
      setStockLoading(false);
    }
  };

  // Filtrer par recherche globale (pays ou actions)
  useEffect(() => {
    if (searchQuery && view === "countries") {
      // La recherche est gérée dans CountryList
    }
  }, [searchQuery, view]);

  return (
    <div style={{
      fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, sans-serif",
      background: "#080c1a", color: "#e2e8f0", minHeight: "100vh", maxWidth: 480,
      margin: "0 auto", position: "relative"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #475569; }
        button:hover { opacity: 0.9; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      `}</style>

      <NavBar view={view} setView={setView} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Bouton actualiser */}
      {view === "countries" && (
        <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {countries.filter(c => c.overall_score).length}/{countries.length} pays analysés
          </div>
          <button onClick={refreshCountries} disabled={loading} style={{
            padding: "6px 14px", borderRadius: 8, background: loading ? "#334155" : "#3b82f6",
            border: "none", color: "white", fontSize: 12, fontWeight: 600,
            cursor: loading ? "default" : "pointer"
          }}>
            {loading ? "⏳ Analyse en cours..." : "🔄 Actualiser les analyses"}
          </button>
        </div>
      )}

      {/* Vues */}
      {view === "countries" && (
        <CountryList
          countries={countries}
          onSelect={selectCountry}
          filter={filter}
          setFilter={setFilter}
          searchQuery={searchQuery}
          loading={loading}
        />
      )}

      {view === "countryDetail" && selectedCountry && (
        <CountryDetail
          country={selectedCountry}
          onBack={() => { setView("countries"); setSelectedCountry(null); }}
          onSelectStock={(s) => selectStock(s, "country")}
          loading={countryLoading}
        />
      )}

      {view === "stockDetail" && selectedStock && (
        <StockDetail
          stock={selectedStock}
          onBack={() => {
            setView(stockFrom === "country" ? "countryDetail" : "search");
            setSelectedStock(null);
          }}
          loading={stockLoading}
        />
      )}

      {view === "watchlists" && (
        <WatchlistView onSelectStock={(s) => selectStock(s, "search")} />
      )}

      {view === "search" && (
        <SearchView onSelectStock={(s) => selectStock(s, "search")} />
      )}
    </div>
  );
}
