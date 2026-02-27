'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { COUNTRY_DATA, PEA_COUNTRIES, cycleColors, cycleIcons, signalColors } from '../lib/constants';
import { storage } from '../lib/storage';
import { fetchCountryAnalysis, fetchStockAnalysis, fetchETFAnalysis, searchStocks, fetchAISuggestedTPSL, fetchCurrentPrice } from '../lib/api';
import { getPortfolio, savePortfolio, addPosition, updateTPSL, updateCurrentPrice, removePosition, calcPnL, calcPortfolioSummary, updatePosition } from '../lib/portfolio';
import { calcTPSLProbability, calcCursorPosition } from '../lib/probability';

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS UI DE BASE
// ═══════════════════════════════════════════════════════════════

function ScoreBadge({ score, label }) {
  const color = score >= 7.5 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px',
        background: `conic-gradient(${color} ${(score || 0) * 36}deg, #1e293b ${(score || 0) * 36}deg)`,
        position: 'relative'
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color
        }}>{score?.toFixed?.(1) ?? '—'}</div>
      </div>
      {label && <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>}
    </div>
  );
}

function CycleBadge({ cycle, phase }) {
  const c = cycleColors[cycle] || '#64748b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        background: c + '22', color: c, padding: '3px 10px', borderRadius: 12,
        fontSize: 12, fontWeight: 600, border: `1px solid ${c}44`
      }}>{cycleIcons[cycle]} {cycle}</span>
      {phase != null && (
        <div style={{ position: 'relative', width: 50, height: 6, background: '#1e293b', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3, width: `${phase}%`, background: c }} />
          <span style={{ position: 'absolute', top: -14, left: `${Math.min(phase, 90)}%`, fontSize: 9, color: c }}>{phase?.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

function SignalBadge({ signal }) {
  const s = signalColors[signal] || { bg: '#334155', color: '#cbd5e1' };
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 6,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5
    }}>{signal}</span>
  );
}

function LoadingSpinner({ text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #1e293b', borderTop: '3px solid #3b82f6',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: '#94a3b8', fontSize: 13 }}>{text || 'Chargement...'}</p>
    </div>
  );
}

function PriceCursor({ currentPrice, tp, sl, tpProb, slProb, avgCost }) {
  if (!currentPrice || !tp || !sl) return null;
  const position = calcCursorPosition(currentPrice, tp, sl);
  const clampedPos = Math.max(2, Math.min(98, position));

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6 }}>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>SL {sl}</span>
        {avgCost && <span style={{ color: '#94a3b8', fontSize: 9 }}>PRU {avgCost}</span>}
        <span style={{ color: '#22c55e', fontWeight: 600 }}>TP {tp}</span>
      </div>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, margin: '4px 0',
        background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 35%, #eab308 50%, #22c55e 100%)'
      }}>
        <div style={{
          position: 'absolute', left: `${clampedPos}%`, top: -3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          border: '3px solid #3b82f6', transform: 'translateX(-50%)',
          boxShadow: '0 0 8px rgba(59,130,246,0.6)', zIndex: 2
        }} />
        {avgCost && (() => {
          const avgPos = calcCursorPosition(avgCost, tp, sl);
          const clampedAvg = Math.max(2, Math.min(98, avgPos));
          return <div style={{
            position: 'absolute', left: `${clampedAvg}%`, top: 0, bottom: 0,
            width: 2, background: '#94a3b8', transform: 'translateX(-50%)', zIndex: 1, opacity: 0.5
          }} />;
        })()}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ color: '#ef4444', fontSize: 11 }}>Risque: {slProb || '—'}%</span>
        <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{currentPrice}</span>
        <span style={{ color: '#22c55e', fontSize: 11 }}>Objectif: {tpProb || '—'}%</span>
      </div>
    </div>
  );
}

// Helper: display a key-value row
function InfoRow({ label, value, color }) {
  if (value == null || value === '' || value === 'N/A') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e293b22' }}>
      <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
      <span style={{ color: color || '#e2e8f0', fontSize: 11, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Helper: collapsible section
function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'none', border: 'none', textAlign: 'left',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, marginBottom: open ? 8 : 0
      }}>
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{icon} {title}</span>
        <span style={{ color: '#475569', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════

function NavBar({ activeTab, setActiveTab, searchQuery, setSearchQuery, loadProgress }) {
  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100, background: '#0a0f1e',
        borderBottom: '1px solid #1e293b', backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6', letterSpacing: -1, whiteSpace: 'nowrap' }}>
            📊 InvestScope
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Rechercher action ou pays..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '7px 12px', borderRadius: 10,
                background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
                fontSize: 12, outline: 'none'
              }}
            />
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Déconnexion"
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
              fontSize: 16, cursor: 'pointer', padding: '4px 6px', lineHeight: 1,
            }}
          >
            ⏻
          </button>
        </div>
        {loadProgress && loadProgress.total > 0 && loadProgress.done < loadProgress.total && (
          <div style={{ height: 3, background: '#1e293b' }}>
            <div style={{
              height: 3, background: loadProgress.phase === 'stocks' ? '#22c55e' : '#3b82f6',
              borderRadius: '0 2px 2px 0',
              width: `${(loadProgress.done / loadProgress.total) * 100}%`,
              transition: 'width 0.5s ease'
            }} />
          </div>
        )}
        {loadProgress && loadProgress.total > 0 && loadProgress.done < loadProgress.total && (
          <div style={{ textAlign: 'center', fontSize: 9, color: '#64748b', padding: '2px 0' }}>
            {loadProgress.phase === 'countries' ? `Analyse pays ${loadProgress.done}/${loadProgress.total}` : `Analyse actions ${loadProgress.done}/${loadProgress.total}`}
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
        background: '#0a0f1e', borderTop: '1px solid #1e293b', zIndex: 100,
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        {[
          { id: 'countries', icon: '🌍', label: 'Pays' },
          { id: 'watchlist', icon: '⭐', label: 'Suivi' },
          { id: 'portfolio', icon: '💼', label: 'Portfolio' },
          { id: 'search', icon: '🔎', label: 'Recherche' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: '8px 0 6px', background: 'transparent',
            border: 'none', borderTop: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === tab.id ? '#3b82f6' : '#64748b',
            fontSize: 10, fontWeight: 600, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2
          }}>
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONGLET PAYS - LISTE
// ═══════════════════════════════════════════════════════════════

function CountryList({ countries, onSelect, searchQuery }) {
  const [filter, setFilter] = useState('all');

  const filtered = countries
    .filter(c => {
      if (filter === 'pea' && !PEA_COUNTRIES.includes(c.code)) return false;
      if (filter === 'horspea' && PEA_COUNTRIES.includes(c.code)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.region.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ display: 'flex', gap: 8, padding: '12px 0', overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'Tous' },
          { id: 'pea', label: '🇪🇺 PEA' },
          { id: 'horspea', label: '🌏 Hors PEA' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid',
            borderColor: filter === f.id ? '#3b82f6' : '#334155',
            background: filter === f.id ? '#3b82f622' : 'transparent',
            color: filter === f.id ? '#3b82f6' : '#94a3b8',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
          }}>{f.label}</button>
        ))}
      </div>

      {filtered.map((country, idx) => (
        <button key={country.code} onClick={() => onSelect(country)} className="fade-in" style={{
          width: '100%', padding: '12px', marginBottom: 6, borderRadius: 12,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #1e293b', cursor: 'pointer', textAlign: 'left',
          animationDelay: `${idx * 30}ms`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: idx < 3 ? '#3b82f622' : '#1e293b',
              color: idx < 3 ? '#3b82f6' : '#64748b', fontSize: 11, fontWeight: 700
            }}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 18 }}>{country.flag}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</span>
                {PEA_COUNTRIES.includes(country.code) && (
                  <span style={{ fontSize: 8, background: '#3b82f622', color: '#60a5fa', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>PEA</span>
                )}
              </div>
              {country.cycle && <div style={{ marginTop: 3 }}><CycleBadge cycle={country.cycle} phase={country.cycle_phase} /></div>}
            </div>
            {country.overall_score != null && (
              <div style={{
                fontSize: 18, fontWeight: 800, minWidth: 36, textAlign: 'right',
                color: country.overall_score >= 7 ? '#22c55e' : country.overall_score >= 5 ? '#f59e0b' : '#ef4444'
              }}>{country.overall_score.toFixed(1)}</div>
            )}
            {!country.overall_score && (
              <div style={{ width: 20, height: 20, border: '2px solid #334155', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            )}
          </div>
        </button>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Aucun pays trouvé</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONGLET PAYS - DÉTAIL (with real data mapping)
// ═══════════════════════════════════════════════════════════════

function CountryDetail({ country, onBack, onSelectStock, loading }) {
  // Map field names from API response
  const c = country;
  const gdpForecasts = c.macroData?.gdpForecasts || c.gdp_forecasts || c.gdp_last5 || [];
  const topStocks = c.top5_stocks || c.top_stocks || [];
  const sectorsBuyStrong = c.sectors_strong_buy || c.sectors_buy_strong || [];
  const sectorsBuy = c.sectors_buy || [];
  const sectorsSell = c.sectors_sell || [];
  const sectorsSellStrong = c.sectors_strong_sell || c.sectors_sell_strong || [];
  const cycleReasoning = c.cycle_methodology || c.cycle_reasoning || c.cycle_explanation || '';
  const cycleConfidence = c.cycle_confidence || '';
  const cycleNextPhase = c.cycle_next_phase || '';
  const macroReasoning = c.macro_reasoning || c.score_explanation || '';
  const unemployment = c.unemployment_rate || c.unemployment;
  const riskFactors = c.risk_factors || [];
  const catalysts = c.catalysts || [];

  return (
    <div style={{ padding: '0 12px' }} className="fade-in">
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 8,
          padding: '8px 12px', fontSize: 16
        }}>←</button>
        <span style={{ fontSize: 28 }}>{c.flag}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>{c.name}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
            {PEA_COUNTRIES.includes(c.code) && <span style={{ fontSize: 9, background: '#3b82f622', color: '#60a5fa', padding: '1px 5px', borderRadius: 4 }}>PEA</span>}
            <span style={{ fontSize: 9, color: '#64748b' }}>Maj: {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('fr-FR') : '—'}</span>
          </div>
        </div>
        {c.overall_score != null && (
          <div style={{ fontSize: 24, fontWeight: 800, color: c.overall_score >= 7 ? '#22c55e' : c.overall_score >= 5 ? '#f59e0b' : '#ef4444' }}>
            {c.overall_score.toFixed(1)}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner text={`Analyse de ${c.name}...`} /> : (
        <>
          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { s: c.macro_score, l: 'Macro' },
              { s: c.geo_score, l: 'Géo' },
              { s: c.micro_score, l: 'Micro' },
              { s: c.sentiment_score, l: 'Sent.' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#0f172a', borderRadius: 10, padding: 10, textAlign: 'center', border: '1px solid #1e293b' }}>
                <ScoreBadge score={item.s} label={item.l} />
              </div>
            ))}
          </div>

          {/* Cycle — Institutional Grade */}
          {c.cycle && (
            <Section title="CYCLE ÉCONOMIQUE (NBER/CEPR)" icon="📈" defaultOpen={true}>
              <CycleBadge cycle={c.cycle} phase={c.cycle_phase} />
              {c.output_gap_estimate && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: '#1e293b', borderRadius: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 9, fontWeight: 600 }}>OUTPUT GAP: </span>
                  <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600 }}>{c.output_gap_estimate}</span>
                </div>
              )}
              {cycleConfidence && (
                <div style={{ marginTop: 4, fontSize: 10 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Confiance: </span>
                  <span style={{ color: cycleConfidence.includes('haute') ? '#22c55e' : cycleConfidence.includes('basse') ? '#ef4444' : '#f59e0b' }}>{cycleConfidence}</span>
                </div>
              )}
              {cycleNextPhase && (
                <div style={{ marginTop: 4, fontSize: 10 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Phase suivante: </span>
                  <span style={{ color: '#cbd5e1' }}>{cycleNextPhase}</span>
                </div>
              )}
              {cycleReasoning && <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{cycleReasoning}</p>}
            </Section>
          )}

          {/* Indicateurs macro */}
          <Section title="INDICATEURS MACROÉCONOMIQUES" icon="📊" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
              <InfoRow label="Taux directeur" value={c.central_bank_rate} />
              <InfoRow label="Chômage" value={unemployment} />
              <InfoRow label="Inflation CPI" value={c.inflation_cpi} />
              <InfoRow label="Inflation core" value={c.inflation_core} />
              <InfoRow label="PMI Manuf." value={c.pmi_manufacturing} />
              <InfoRow label="PMI Services" value={c.pmi_services} />
            </div>

            {/* PIB — Prévisions FMI (historique + forecast) */}
            {gdpForecasts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📈 CROISSANCE PIB — PRÉVISIONS FMI</div>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                  {gdpForecasts.map((g, i) => {
                    const val = typeof g === 'object' ? g.value : g;
                    const year = typeof g === 'object' ? (g.year || g.date) : '';
                    const isForecast = typeof g === 'object' ? g.isForecast : false;
                    const numVal = parseFloat(String(val).replace('%', ''));
                    const displayVal = typeof numVal === 'number' && !isNaN(numVal) ? `${numVal.toFixed(1)}%` : val;
                    const barH = Math.max(12, Math.min(50, Math.abs(numVal) * 8));
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{
                          height: barH, borderRadius: '3px 3px 0 0', margin: '0 auto', width: '80%',
                          background: isForecast
                            ? (numVal >= 0 ? 'repeating-linear-gradient(45deg, #22c55e33, #22c55e33 2px, #22c55e11 2px, #22c55e11 4px)' : 'repeating-linear-gradient(45deg, #ef444433, #ef444433 2px, #ef444411 2px, #ef444411 4px)')
                            : (numVal >= 0 ? '#22c55e33' : '#ef444433'),
                          border: isForecast ? `1px dashed ${numVal >= 0 ? '#22c55e55' : '#ef444455'}` : 'none'
                        }} />
                        <div style={{
                          padding: '3px 1px', borderRadius: '0 0 4px 4px',
                          background: isForecast ? '#3b82f611' : (numVal >= 0 ? '#22c55e08' : '#ef444408'),
                          color: numVal >= 0 ? '#22c55e' : '#ef4444', fontSize: 9, fontWeight: 700
                        }}>{displayVal}</div>
                        <div style={{ fontSize: 7, color: isForecast ? '#3b82f6' : '#475569', marginTop: 1 }}>
                          {year}{isForecast ? '*' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 8, color: '#475569', marginTop: 4, textAlign: 'right' }}>* Prévisions FMI WEO</div>
              </div>
            )}
          </Section>

          {/* Indicateurs avancés */}
          {(c.building_permits_trend || c.private_credit_trend || c.capital_flows || c.output_gap_estimate || c.yield_curve || c.inflation_trend || c.credit_growth || c.central_bank_bias) && (
            <Section title="INDICATEURS AVANCÉS" icon="🔍" defaultOpen={false}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {c.yield_curve && (
                  <InfoRow label="Courbe des taux" value={c.yield_curve} color={c.yield_curve.toLowerCase().includes('invers') ? '#ef4444' : c.yield_curve.toLowerCase().includes('normal') ? '#22c55e' : '#f59e0b'} />
                )}
                {c.inflation_trend && (
                  <InfoRow label="Tendance inflation" value={c.inflation_trend} color={c.inflation_trend.toLowerCase().includes('baiss') ? '#22c55e' : c.inflation_trend.toLowerCase().includes('hauss') ? '#ef4444' : '#f59e0b'} />
                )}
                {c.credit_growth && (
                  <InfoRow label="Croissance crédit" value={c.credit_growth} />
                )}
                {c.central_bank_bias && (
                  <InfoRow label="Biais banque centrale" value={c.central_bank_bias} color={c.central_bank_bias.toLowerCase().includes('dovish') || c.central_bank_bias.toLowerCase().includes('accommod') ? '#22c55e' : c.central_bank_bias.toLowerCase().includes('hawkish') || c.central_bank_bias.toLowerCase().includes('restrict') ? '#ef4444' : '#f59e0b'} />
                )}
              </div>
              {c.building_permits_trend && (
                <div style={{ marginTop: 6, marginBottom: 4 }}>
                  <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>Permis de construire: </span>
                  <span style={{ color: '#e2e8f0', fontSize: 11 }}>{c.building_permits_trend}</span>
                </div>
              )}
              {c.private_credit_trend && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>Crédit privé: </span>
                  <span style={{ color: '#e2e8f0', fontSize: 11 }}>{c.private_credit_trend}</span>
                </div>
              )}
              {c.capital_flows && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>Flux de capitaux: </span>
                  <span style={{ color: '#e2e8f0', fontSize: 11 }}>{c.capital_flows}</span>
                </div>
              )}
              {c.imf_estimates && (
                <div>
                  <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600 }}>Estimations FMI: </span>
                  <span style={{ color: '#e2e8f0', fontSize: 11 }}>{c.imf_estimates}</span>
                </div>
              )}
            </Section>
          )}

          {/* Secteurs */}
          <Section title="SECTEURS" icon="🏭" defaultOpen={true}>
            {sectorsBuyStrong.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>ACHETER FORT ▲▲</div>
                {sectorsBuyStrong.map((s, i) => (
                  <div key={`bs${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: '1px solid #1e293b22' }}>
                    <span style={{ background: '#22c55e22', color: '#22c55e', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>FORT</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {sectorsBuy.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: '#86efac', fontWeight: 700, marginTop: sectorsBuyStrong.length > 0 ? 8 : 0, marginBottom: 4 }}>ACHETER ▲</div>
                {sectorsBuy.map((s, i) => (
                  <div key={`b${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: '1px solid #1e293b22' }}>
                    <span style={{ background: '#22c55e11', color: '#86efac', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>BUY</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {sectorsSell.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: '#fca5a5', fontWeight: 700, marginTop: 8, marginBottom: 4 }}>VENDRE ▼</div>
                {sectorsSell.map((s, i) => (
                  <div key={`s${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: '1px solid #1e293b22' }}>
                    <span style={{ background: '#ef444411', color: '#fca5a5', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>SELL</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {sectorsSellStrong.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, marginTop: 8, marginBottom: 4 }}>VENDRE FORT ▼▼</div>
                {sectorsSellStrong.map((s, i) => (
                  <div key={`ss${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0', borderBottom: '1px solid #1e293b22' }}>
                    <span style={{ background: '#ef444422', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>FORT</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {c.sectors_reasoning && (
              <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>{c.sectors_reasoning}</p>
            )}
          </Section>

          {/* Top 5 actions */}
          <Section title="TOP 5 ACTIONS RECOMMANDÉES" icon="🏆" defaultOpen={true}>
            {topStocks.map((stock, i) => (
              <button key={i} onClick={() => onSelectStock(stock)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 6px', background: i % 2 === 0 ? '#1e293b33' : 'transparent',
                border: 'none', borderRadius: 6, textAlign: 'left'
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5, background: '#3b82f622',
                  color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700
                }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{stock.symbol}</div>
                  <div style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name} • {stock.sector}</div>
                  {stock.reason && <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 2 }}>{stock.reason}</div>}
                </div>
                {stock.estimated_growth && <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>+{stock.estimated_growth}</div>}
                {stock.score && <ScoreBadge score={stock.score} />}
                <span style={{ color: '#3b82f6', fontSize: 14 }}>›</span>
              </button>
            ))}
          </Section>

          {/* Actualités */}
          <Section title="ACTUALITÉ & IMPACT" icon="📰" defaultOpen={true}>
            {c.news_summary && <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.6, margin: '0 0 8px' }}>{c.news_summary}</p>}
            {(c.news_impact_court_terme || c.news_impact_moyen_terme || c.news_impact_long_terme) && (
              <div style={{ display: 'grid', gap: 4 }}>
                {c.news_impact_court_terme && <div><span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600 }}>Court terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{c.news_impact_court_terme}</span></div>}
                {c.news_impact_moyen_terme && <div><span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>Moyen terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{c.news_impact_moyen_terme}</span></div>}
                {c.news_impact_long_terme && <div><span style={{ color: '#8b5cf6', fontSize: 10, fontWeight: 600 }}>Long terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{c.news_impact_long_terme}</span></div>}
              </div>
            )}
            {/* Real news articles */}
            {c.news && c.news.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>ARTICLES RÉCENTS</div>
                {c.news.slice(0, 12).map((article, i) => (
                  <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid #1e293b22', textDecoration: 'none' }}>
                    <div style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.3 }}>{article.title}</div>
                    <div style={{ color: '#475569', fontSize: 9, marginTop: 2 }}>
                      {article.source} • {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('fr-FR') : ''}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Section>

          {/* Risques & Catalyseurs */}
          {(riskFactors.length > 0 || catalysts.length > 0) && (
            <Section title="RISQUES & CATALYSEURS" icon="⚠️" defaultOpen={true}>
              {catalysts.length > 0 && (
                <div style={{ marginBottom: riskFactors.length > 0 ? 10 : 0 }}>
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>🚀 CATALYSEURS POSITIFS</div>
                  {catalysts.map((cat, i) => (
                    <div key={`cat${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0' }}>
                      <span style={{ color: '#22c55e', fontSize: 10, flexShrink: 0 }}>▸</span>
                      <span style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.4 }}>{typeof cat === 'string' ? cat : cat.description || cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {riskFactors.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>🛑 FACTEURS DE RISQUE</div>
                  {riskFactors.map((risk, i) => (
                    <div key={`risk${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0' }}>
                      <span style={{ color: '#ef4444', fontSize: 10, flexShrink: 0 }}>▸</span>
                      <span style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.4 }}>{typeof risk === 'string' ? risk : risk.description || risk.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Justification des scores */}
          {macroReasoning && (
            <Section title="JUSTIFICATION DES SCORES" icon="💡" defaultOpen={false}>
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6, margin: 0 }}>{macroReasoning}</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DÉTAIL ACTION (with real data mapping)
// ═══════════════════════════════════════════════════════════════

function StockDetail({ stock, onBack, loading, watchlist, toggleWatchlist }) {
  const s = stock;
  const inWatchlist = watchlist.some(w => w.symbol === s.symbol);

  // Map field names from API
  const price = s.price || 0;
  const currency = s.currency || '';
  const per = s.per ?? s.pe ?? null;
  const peg = s.peg ?? null;
  const payoutRatio = s.payoutRatio != null ? `${(s.payoutRatio * 100).toFixed(1)}%` : (s.payout_ratio || null);
  const roic = s.roic != null ? `${(s.roic * 100).toFixed(1)}%` : (s.roic_wacc || null);
  const debtToAssets = s.debtToAssets != null ? `${(s.debtToAssets * 100).toFixed(1)}%` : (s.debt_assets || null);
  const leverage = s.leverage != null ? `${s.leverage.toFixed?.(2) || s.leverage}x` : null;
  const rsi = s.rsi ?? null;
  const annualVol = s.annualVolatility || s.annual_volatility || 0.3;
  const sharpe = s.sharpe_ratio ?? null;

  const probs = s.tp && s.sl && price
    ? calcTPSLProbability(price, s.tp, s.sl, annualVol, s.estimated_days)
    : { tpProb: s.tp_probability, slProb: s.sl_probability };

  const tpReasoning = s.tp_reasoning || '';
  const slReasoning = s.sl_reasoning || '';
  const probMethod = s.probability_method || '';
  const scoreReasoning = s.score_reasoning || s.rating_explanation || '';
  const fundamentalAnalysis = s.fundamental_analysis || '';
  const technicalAnalysis = s.technical_analysis || '';

  return (
    <div style={{ padding: '0 12px' }} className="fade-in">
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 8, padding: '8px 12px', fontSize: 16 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>{s.symbol}</h2>
          <div style={{ color: '#64748b', fontSize: 11 }}>{s.companyName || s.name}</div>
        </div>
        <button onClick={() => toggleWatchlist(s)} style={{
          background: 'none', border: 'none', fontSize: 22, padding: 4
        }}>{inWatchlist ? '⭐' : '☆'}</button>
        {price > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700 }}>{price} {currency}</div>
            <span style={{ fontSize: 9, color: '#64748b' }}>Maj: {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('fr-FR') : '—'}</span>
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner text={`Analyse de ${s.symbol}...`} /> : (
        <>
          {/* Signal */}
          {s.signal && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <SignalBadge signal={s.signal} />
            </div>
          )}

          {/* TP / SL */}
          {s.tp && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginBottom: 3 }}>🎯 TAKE PROFIT</div>
                  <div style={{ fontSize: 20, color: '#22c55e', fontWeight: 800 }}>{s.tp} {currency}</div>
                  <div style={{ fontSize: 10, color: '#86efac' }}>+{s.gain_pct}% • Proba: {probs.tpProb}%</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>~{s.estimated_days}j estimés</div>
                </div>
                <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>🛑 STOP LOSS</div>
                  <div style={{ fontSize: 20, color: '#ef4444', fontWeight: 800 }}>{s.sl} {currency}</div>
                  <div style={{ fontSize: 10, color: '#fca5a5' }}>{s.loss_pct}% • Proba: {probs.slProb}%</div>
                </div>
              </div>
              <PriceCursor currentPrice={price} tp={s.tp} sl={s.sl} tpProb={probs.tpProb} slProb={probs.slProb} />
              {s.max_gain_loss_ratio && (
                <div style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>
                  Ratio gain/perte max: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{s.max_gain_loss_ratio}</span>
                </div>
              )}
            </>
          )}

          {/* Ratios fondamentaux */}
          <Section title="RATIOS FONDAMENTAUX" icon="📐" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <InfoRow label="PER" value={per} color={per && per < 15 ? '#22c55e' : per > 30 ? '#ef4444' : '#f59e0b'} />
              <InfoRow label="PEG" value={peg?.toFixed?.(2) ?? peg} color={peg && peg < 1 ? '#22c55e' : peg > 2 ? '#ef4444' : '#f59e0b'} />
              <InfoRow label="Payout Ratio" value={payoutRatio} />
              <InfoRow label="ROIC" value={roic} />
              <InfoRow label="Dette/Actifs" value={debtToAssets} />
              <InfoRow label="Leverage" value={leverage} />
              <InfoRow label="Marge nette" value={s.net_margin != null ? `${(s.net_margin * 100).toFixed(1)}%` : s.netMargin} />
              <InfoRow label="RSI" value={rsi?.toFixed?.(1) ?? rsi} color={rsi && rsi < 30 ? '#22c55e' : rsi > 70 ? '#ef4444' : '#f59e0b'} />
              <InfoRow label="Sharpe Ratio" value={sharpe?.toFixed?.(2) ?? sharpe} />
              <InfoRow label="Volatilité ann." value={annualVol ? `${(annualVol * 100).toFixed(1)}%` : null} />
            </div>
            {s.net_margin_evolution && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>Évolution marge nette</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {(Array.isArray(s.net_margin_evolution) ? s.net_margin_evolution : []).map((m, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: 3, borderRadius: 4, background: '#1e293b', fontSize: 9 }}>
                      {m.year && <div style={{ color: '#64748b', fontSize: 8 }}>{m.year}</div>}
                      <div style={{ color: parseFloat(String(m.value || m).replace('%', '')) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{m.value || m}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Score et Analyse */}
          <Section title="SCORE & SIGNAL" icon="🎯" defaultOpen={true}>
            {s.overall_score != null && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
                <ScoreBadge score={s.overall_score} label="Global" />
                {s.fundamental_score != null && <ScoreBadge score={s.fundamental_score} label="Fondamental" />}
                {s.technical_score != null && <ScoreBadge score={s.technical_score} label="Technique" />}
              </div>
            )}
            {scoreReasoning && <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6, margin: 0 }}>{scoreReasoning}</p>}
          </Section>

          {/* Analyse fondamentale détaillée */}
          {fundamentalAnalysis && (
            <Section title="ANALYSE FONDAMENTALE" icon="📊" defaultOpen={false}>
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{fundamentalAnalysis}</p>
            </Section>
          )}

          {/* Analyse technique détaillée */}
          {technicalAnalysis && (
            <Section title="ANALYSE TECHNIQUE" icon="📈" defaultOpen={false}>
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{technicalAnalysis}</p>
            </Section>
          )}

          {/* Méthodologie TP/SL */}
          {(tpReasoning || slReasoning || probMethod) && (
            <Section title="MÉTHODOLOGIE TP/SL" icon="🧮" defaultOpen={false}>
              {tpReasoning && <div style={{ marginBottom: 6 }}><span style={{ color: '#22c55e', fontSize: 10, fontWeight: 600 }}>TP: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{tpReasoning}</span></div>}
              {slReasoning && <div style={{ marginBottom: 6 }}><span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>SL: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{slReasoning}</span></div>}
              {probMethod && <div><span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>Méthode: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{probMethod}</span></div>}
            </Section>
          )}

          {/* Actualités impact */}
          {(s.news_impact_short || s.news_impact_medium || s.news_impact_long || s.news_summary) && (
            <Section title="IMPACT ACTUALITÉ" icon="📰" defaultOpen={true}>
              {s.news_summary && <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.5, margin: '0 0 6px' }}>{s.news_summary}</p>}
              {s.news_impact_short && <div><span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600 }}>Court terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{s.news_impact_short}</span></div>}
              {s.news_impact_medium && <div><span style={{ color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>Moyen terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{s.news_impact_medium}</span></div>}
              {s.news_impact_long && <div><span style={{ color: '#8b5cf6', fontSize: 10, fontWeight: 600 }}>Long terme: </span><span style={{ color: '#94a3b8', fontSize: 10 }}>{s.news_impact_long}</span></div>}
            </Section>
          )}

          {/* Dividende */}
          {(s.next_dividend_date || s.dividend_yield) && (
            <Section title="DIVIDENDE" icon="💰" defaultOpen={false}>
              <InfoRow label="Rendement" value={s.dividend_yield} />
              <InfoRow label="Prochain détachement" value={s.next_dividend_date} />
              <InfoRow label="Dernier montant" value={s.last_dividend_amount} />
            </Section>
          )}

          {/* ETF-specific sections */}
          {s.isETF && s.etfData && (
            <>
              {/* ETF Info */}
              {s.etfData.info && (
                <Section title="INFORMATIONS ETF" icon="📋" defaultOpen={true}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    <InfoRow label="AUM" value={s.etfData.info.totalAssets ? `${(s.etfData.info.totalAssets / 1e9).toFixed(2)}B $` : null} />
                    <InfoRow label="Frais (TER)" value={s.etfData.info.expenseRatio ? `${(s.etfData.info.expenseRatio * 100).toFixed(2)}%` : null} />
                    <InfoRow label="Positions" value={s.etfData.info.holdingsCount} />
                    <InfoRow label="Dividende" value={s.etfData.info.dividendYield ? `${(s.etfData.info.dividendYield * 100).toFixed(2)}%` : null} />
                    <InfoRow label="Beta" value={s.etfData.info.beta?.toFixed(2)} />
                    <InfoRow label="Inception" value={s.etfData.info.inceptionDate} />
                  </div>
                  {s.etfData.info.description && (
                    <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>{s.etfData.info.description.slice(0, 200)}...</p>
                  )}
                </Section>
              )}

              {/* Top Holdings */}
              {s.etfData.holdings && s.etfData.holdings.length > 0 && (
                <Section title={`TOP ${Math.min(15, s.etfData.holdings.length)} POSITIONS`} icon="🏢" defaultOpen={true}>
                  {s.etfData.holdings.slice(0, 15).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #1e293b22' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#64748b' }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.asset || h.name}</div>
                        {h.name && h.asset && <div style={{ color: '#64748b', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>}
                      </div>
                      <div style={{ color: '#3b82f6', fontSize: 11, fontWeight: 700 }}>{h.weightPercentage ? `${parseFloat(h.weightPercentage).toFixed(1)}%` : ''}</div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Sector Weights */}
              {s.etfData.sectors && s.etfData.sectors.length > 0 && (
                <Section title="RÉPARTITION SECTORIELLE" icon="🏭" defaultOpen={true}>
                  {s.etfData.sectors.sort((a, b) => parseFloat(b.weightPercentage || 0) - parseFloat(a.weightPercentage || 0)).map((sec, i) => {
                    const pct = parseFloat(sec.weightPercentage || 0);
                    return (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: '#cbd5e1' }}>{sec.sector}</span>
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
                          <div style={{ height: 4, borderRadius: 2, background: '#3b82f6', width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Country Weights */}
              {s.etfData.countries && s.etfData.countries.length > 0 && (
                <Section title="RÉPARTITION GÉOGRAPHIQUE" icon="🌍" defaultOpen={false}>
                  {s.etfData.countries.sort((a, b) => parseFloat(b.weightPercentage || 0) - parseFloat(a.weightPercentage || 0)).slice(0, 15).map((ctry, i) => {
                    const pct = parseFloat(ctry.weightPercentage || 0);
                    return (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                          <span style={{ color: '#cbd5e1' }}>{ctry.country}</span>
                          <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ height: 4, background: '#1e293b', borderRadius: 2 }}>
                          <div style={{ height: 4, borderRadius: 2, background: '#8b5cf6', width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VUE RECHERCHE
// ═══════════════════════════════════════════════════════════════

function SearchView({ searchQuery, onSelectStock, watchlist, toggleWatchlist }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery || searchQuery.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchStocks(searchQuery);
        setResults(res || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  return (
    <div style={{ padding: '12px' }}>
      {!searchQuery && (
        <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔎</div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Rechercher une action</div>
          <div style={{ fontSize: 11 }}>Tapez un ticker (AAPL, MC.PA) ou un nom</div>
        </div>
      )}
      {searching && <LoadingSpinner text="Recherche..." />}
      {results.map((r, i) => {
        const isWatched = watchlist.some(w => w.symbol === r.symbol);
        return (
          <div key={`${r.symbol}_${i}`} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px',
            borderBottom: '1px solid #1e293b', animationDelay: `${i * 40}ms`
          }} className="fade-in">
            <button onClick={() => onSelectStock(r)} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', textAlign: 'left', padding: 0
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: r.isETF ? '#8b5cf622' : '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: r.isETF ? 11 : 14, fontWeight: 700, color: r.isETF ? '#8b5cf6' : '#3b82f6' }}>
                {r.isETF ? 'ETF' : r.symbol?.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{r.symbol}</span>
                  {r.isETF && <span style={{ fontSize: 8, background: '#8b5cf622', color: '#a78bfa', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>ETF</span>}
                </div>
                <div style={{ color: '#64748b', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name || r.companyName} {r.exchange && `• ${r.exchange}`}
                </div>
              </div>
            </button>
            <button onClick={() => toggleWatchlist(r)} style={{ background: 'none', border: 'none', fontSize: 20, padding: 4 }}>
              {isWatched ? '⭐' : '☆'}
            </button>
          </div>
        );
      })}
      {searchQuery && !searching && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#475569', fontSize: 12 }}>Aucun résultat pour "{searchQuery}"</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VUE SUIVI (WATCHLIST)
// ═══════════════════════════════════════════════════════════════

function WatchlistView({ watchlist, onSelectStock, toggleWatchlist, stockCache }) {
  if (watchlist.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⭐</div>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Liste de suivi vide</div>
        <div style={{ fontSize: 11 }}>Recherchez des actions et ajoutez-les avec ☆</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{watchlist.length} action(s) suivie(s)</div>
      {watchlist.map((stock, i) => {
        const cached = stockCache[stock.symbol];
        const prc = cached?.price || stock.price;
        const sig = cached?.signal || stock.signal;
        return (
          <div key={stock.symbol} className="fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 6px',
            borderBottom: '1px solid #1e293b', animationDelay: `${i * 40}ms`
          }}>
            <button onClick={() => onSelectStock(stock)} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', textAlign: 'left', padding: 0
            }}>
              <div>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{stock.symbol}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{stock.name || stock.companyName}</div>
              </div>
              <div style={{ flex: 1 }} />
              {sig && <SignalBadge signal={sig} />}
              {prc && <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{prc}</div>}
              {cached?.overall_score != null && <ScoreBadge score={cached.overall_score} />}
            </button>
            <button onClick={() => toggleWatchlist(stock)} style={{ background: 'none', border: 'none', fontSize: 18, padding: 4 }}>⭐</button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VUE PORTFOLIO
// ═══════════════════════════════════════════════════════════════

function PortfolioView({ portfolio, setPortfolio }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editPos, setEditPos] = useState(null);
  const [showTPSLHistory, setShowTPSLHistory] = useState(null);
  const [form, setForm] = useState({ symbol: '', name: '', avgCost: '', quantity: '', currency: 'EUR', tp: '', sl: '' });
  const [loadingAI, setLoadingAI] = useState(null);

  const positions = portfolio.positions || [];
  const summary = calcPortfolioSummary(positions);

  // Refresh prices
  useEffect(() => {
    positions.forEach(async (pos) => {
      try {
        const data = await fetchCurrentPrice(pos.symbol);
        if (data?.price) {
          updateCurrentPrice(pos.id, data.price);
          setPortfolio(getPortfolio());
        }
      } catch {}
    });
  }, []); // eslint-disable-line

  const handleAdd = () => {
    if (!form.symbol || !form.avgCost || !form.quantity || !form.tp || !form.sl) return;
    addPosition(form);
    setPortfolio(getPortfolio());
    setShowAdd(false);
    setForm({ symbol: '', name: '', avgCost: '', quantity: '', currency: 'EUR', tp: '', sl: '' });
  };

  const handleUpdateTPSL = (posId, newTP, newSL, reason) => {
    updateTPSL(posId, newTP, newSL, reason);
    setPortfolio(getPortfolio());
  };

  const handleAISuggest = async (pos) => {
    setLoadingAI(pos.id);
    try {
      const suggestion = await fetchAISuggestedTPSL(pos.symbol, pos.currentPrice || pos.avgCost, pos.avgCost, pos.quantity);
      if (suggestion) {
        updatePosition(pos.id, { aiSuggestion: suggestion });
        setPortfolio(getPortfolio());
      }
    } catch {}
    setLoadingAI(null);
  };

  const handleRemove = (posId) => {
    if (confirm('Supprimer cette position ?')) {
      removePosition(posId);
      setPortfolio(getPortfolio());
    }
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Summary */}
      {positions.length > 0 && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #1e293b' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Valeur totale</div>
              <div style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 700 }}>{summary.totalValue.toLocaleString('fr-FR')} €</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>P&L Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: summary.totalPnL >= 0 ? '#22c55e' : '#ef4444' }}>
                {summary.totalPnL >= 0 ? '+' : ''}{summary.totalPnL.toLocaleString('fr-FR')} € ({summary.totalPnLPercent.toFixed(2)}%)
              </div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>Coût total: {summary.totalCost.toLocaleString('fr-FR')} € • {summary.loadedCount}/{summary.totalCount} prix chargés</div>
        </div>
      )}

      {/* Add button */}
      <button onClick={() => setShowAdd(true)} style={{
        width: '100%', padding: 12, borderRadius: 10, border: '2px dashed #334155',
        background: 'transparent', color: '#3b82f6', fontSize: 13, fontWeight: 600,
        marginBottom: 12, cursor: 'pointer'
      }}>+ Ajouter une position</button>

      {/* Add form modal */}
      {showAdd && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #3b82f6' }}>
          <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, marginBottom: 10 }}>Nouvelle position</div>
          {[
            { key: 'symbol', label: 'Symbole (ex: AAPL)', type: 'text' },
            { key: 'name', label: 'Nom (optionnel)', type: 'text' },
            { key: 'avgCost', label: 'PRU (prix moyen)', type: 'number' },
            { key: 'quantity', label: 'Quantité', type: 'number' },
            { key: 'tp', label: 'Take Profit', type: 'number' },
            { key: 'sl', label: 'Stop Loss', type: 'number' },
          ].map(f => (
            <input key={f.key} placeholder={f.label} type={f.type} step="any"
              value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
            />
          ))}
          <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
            style={{ width: '100%', padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }}>
            {['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'KRW', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: 10, borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 600, fontSize: 12 }}>Ajouter</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '10px 16px', borderRadius: 8, background: '#1e293b', border: 'none', color: '#94a3b8', fontSize: 12 }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Positions */}
      {positions.map((pos) => {
        const pnl = calcPnL(pos);
        const probs = pos.tp && pos.sl && pos.currentPrice
          ? calcTPSLProbability(pos.currentPrice, pos.tp, pos.sl)
          : { tpProb: '—', slProb: '—' };

        return (
          <div key={pos.id} style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{pos.symbol}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{pos.name || ''} • {pos.quantity} × {pos.avgCost} {pos.currency}</div>
              </div>
              {pnl.pnlPercent != null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: pnl.pnlPercent >= 0 ? '#22c55e' : '#ef4444' }}>
                    {pnl.pnlPercent >= 0 ? '+' : ''}{pnl.pnlPercent.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 10, color: pnl.pnlAbsolute >= 0 ? '#86efac' : '#fca5a5' }}>
                    {pnl.pnlAbsolute >= 0 ? '+' : ''}{pnl.pnlAbsolute.toFixed(2)} {pos.currency}
                  </div>
                </div>
              )}
            </div>

            {pos.currentPrice && <PriceCursor currentPrice={pos.currentPrice} tp={pos.tp} sl={pos.sl} tpProb={probs.tpProb} slProb={probs.slProb} avgCost={pos.avgCost} />}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setEditPos(editPos === pos.id ? null : pos.id)} style={{
                padding: '5px 10px', borderRadius: 6, background: '#1e293b', border: 'none', color: '#94a3b8', fontSize: 10
              }}>✏️ Modifier TP/SL</button>
              <button onClick={() => handleAISuggest(pos)} disabled={loadingAI === pos.id} style={{
                padding: '5px 10px', borderRadius: 6, background: '#3b82f622', border: 'none', color: '#3b82f6', fontSize: 10
              }}>{loadingAI === pos.id ? '⏳...' : '🤖 Suggestion IA'}</button>
              <button onClick={() => setShowTPSLHistory(showTPSLHistory === pos.id ? null : pos.id)} style={{
                padding: '5px 10px', borderRadius: 6, background: '#1e293b', border: 'none', color: '#94a3b8', fontSize: 10
              }}>📜 Historique</button>
              <button onClick={() => handleRemove(pos.id)} style={{
                padding: '5px 10px', borderRadius: 6, background: '#ef444422', border: 'none', color: '#ef4444', fontSize: 10
              }}>🗑️</button>
            </div>

            {/* AI Suggestion */}
            {pos.aiSuggestion && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: '#3b82f611', border: '1px solid #3b82f633' }}>
                <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>🤖 SUGGESTION IA</div>
                <div style={{ fontSize: 11, color: '#e2e8f0' }}>
                  TP: {pos.aiSuggestion.tp} • SL: {pos.aiSuggestion.sl}
                </div>
                {pos.aiSuggestion.reasoning && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{pos.aiSuggestion.reasoning}</div>}
                <button onClick={() => handleUpdateTPSL(pos.id, pos.aiSuggestion.tp, pos.aiSuggestion.sl, 'Suggestion IA acceptée')} style={{
                  marginTop: 6, padding: '5px 12px', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 10, fontWeight: 600
                }}>Appliquer</button>
              </div>
            )}

            {/* Edit TP/SL form */}
            {editPos === pos.id && (
              <EditTPSLForm pos={pos} onSave={(tp, sl, reason) => { handleUpdateTPSL(pos.id, tp, sl, reason); setEditPos(null); }} onCancel={() => setEditPos(null)} />
            )}

            {/* TP/SL History */}
            {showTPSLHistory === pos.id && pos.tpHistory && (
              <div style={{ marginTop: 8, padding: 8, background: '#1e293b', borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>HISTORIQUE TP/SL</div>
                {pos.tpHistory.map((h, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #0f172a', fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>{new Date(h.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ color: '#e2e8f0' }}>TP: {h.tp} / SL: {h.sl}</span>
                    </div>
                    {h.reason && <div style={{ color: '#475569', fontSize: 9 }}>{h.reason}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {positions.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: 30, color: '#475569' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>💼</div>
          <div style={{ fontSize: 12 }}>Votre portfolio est vide</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Ajoutez vos positions pour suivre vos investissements</div>
        </div>
      )}
    </div>
  );
}

function EditTPSLForm({ pos, onSave, onCancel }) {
  const [tp, setTp] = useState(pos.tp);
  const [sl, setSl] = useState(pos.sl);
  const [reason, setReason] = useState('');
  return (
    <div style={{ marginTop: 8, padding: 10, background: '#1e293b', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input type="number" step="any" value={tp} onChange={e => setTp(e.target.value)} placeholder="Nouveau TP"
          style={{ flex: 1, padding: 6, borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, outline: 'none' }} />
        <input type="number" step="any" value={sl} onChange={e => setSl(e.target.value)} placeholder="Nouveau SL"
          style={{ flex: 1, padding: 6, borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, outline: 'none' }} />
      </div>
      <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison (optionnel)"
        style={{ width: '100%', padding: 6, marginBottom: 6, borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, outline: 'none' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave(tp, sl, reason)} style={{ flex: 1, padding: 6, borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600 }}>Sauver</button>
        <button onClick={onCancel} style={{ padding: '6px 12px', borderRadius: 6, background: '#0f172a', border: 'none', color: '#94a3b8', fontSize: 11 }}>Annuler</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION PRINCIPALE
// ═══════════════════════════════════════════════════════════════

function InvestScopeApp() {
  const [activeTab, setActiveTab] = useState('countries');
  const [searchQuery, setSearchQuery] = useState('');
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loadingCountry, setLoadingCountry] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState({ positions: [] });
  const [stockCache, setStockCache] = useState({});
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0, phase: 'countries' });
  const loadingRef = useRef(false);

  // Init: load from localStorage
  useEffect(() => {
    const saved = storage.get('watchlist');
    if (saved) setWatchlist(saved);
    setPortfolio(getPortfolio());

    // Init countries from constants
    const list = Object.entries(COUNTRY_DATA).map(([code, c]) => {
      const cached = storage.get(`country_${code}`);
      return { code, ...c, ...(cached || {}) };
    });
    setCountries(list);
  }, []);

  // Auto-load all countries in background
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const entries = Object.entries(COUNTRY_DATA);
    const unloaded = entries.filter(([code]) => !storage.get(`country_${code}`));
    if (unloaded.length === 0) return;

    setLoadProgress({ done: 0, total: unloaded.length, phase: 'countries' });
    let done = 0;

    (async () => {
      const BATCH = 2;
      for (let i = 0; i < unloaded.length; i += BATCH) {
        const batch = unloaded.slice(i, i + BATCH);
        const promises = batch.map(async ([code, c]) => {
          try {
            const analysis = await fetchCountryAnalysis(c.name, code);
            if (analysis) {
              storage.set(`country_${code}`, analysis, 24 * 3600 * 1000);
              setCountries(prev => prev.map(p => p.code === code ? { ...p, ...analysis } : p));
            }
          } catch (e) { console.warn(`Failed to load ${code}:`, e); }
        });
        await Promise.all(promises);
        done += batch.length;
        setLoadProgress({ done, total: unloaded.length, phase: 'countries' });
        if (i + BATCH < unloaded.length) await new Promise(r => setTimeout(r, 3000));
      }
      loadingRef.current = false;
    })();
  }, []); // eslint-disable-line

  const handleSelectCountry = useCallback(async (country) => {
    setSelectedCountry(country);
    setSelectedStock(null);
    if (!country.overall_score) {
      setLoadingCountry(true);
      try {
        const analysis = await fetchCountryAnalysis(country.name, country.code);
        if (analysis) {
          storage.set(`country_${country.code}`, analysis, 24 * 3600 * 1000);
          const updated = { ...country, ...analysis };
          setSelectedCountry(updated);
          setCountries(prev => prev.map(p => p.code === country.code ? updated : p));
        }
      } catch (e) { console.error('Country analysis failed:', e); }
      setLoadingCountry(false);
    }
  }, []);

  const handleSelectStock = useCallback(async (stock) => {
    setSelectedStock(stock);
    setActiveTab('search');
    if (!stock.overall_score) {
      setLoadingStock(true);
      try {
        let analysis;
        if (stock.isETF) {
          // ETF-specific analysis pipeline
          analysis = await fetchETFAnalysis(stock.symbol, stock.name || stock.companyName || '');
        } else {
          // Regular stock analysis
          const countryName = selectedCountry?.name || '';
          analysis = await fetchStockAnalysis(stock.symbol, stock.name || stock.companyName || '', countryName);
        }
        if (analysis) {
          const updated = { ...stock, ...analysis, isETF: stock.isETF };
          setSelectedStock(updated);
          setStockCache(prev => ({ ...prev, [stock.symbol]: updated }));
          storage.set(`stock_${stock.symbol}`, updated, 12 * 3600 * 1000);
        }
      } catch (e) { console.error('Analysis failed:', e); }
      setLoadingStock(false);
    }
  }, [selectedCountry]);

  const toggleWatchlist = useCallback((stock) => {
    setWatchlist(prev => {
      const exists = prev.some(w => w.symbol === stock.symbol);
      const updated = exists ? prev.filter(w => w.symbol !== stock.symbol) : [...prev, { symbol: stock.symbol, name: stock.name || stock.companyName || '' }];
      storage.set('watchlist', updated, null);
      return updated;
    });
  }, []);

  const handleBack = useCallback(() => {
    if (selectedStock) { setSelectedStock(null); }
    else if (selectedCountry) { setSelectedCountry(null); }
  }, [selectedStock, selectedCountry]);

  // Redirect search input to search tab
  useEffect(() => {
    if (searchQuery && activeTab !== 'search' && !selectedCountry && !selectedStock) {
      setActiveTab('search');
    }
  }, [searchQuery, activeTab, selectedCountry, selectedStock]);

  // Render content based on active tab
  const renderContent = () => {
    // Stock detail view (accessible from anywhere)
    if (selectedStock) {
      return <StockDetail stock={selectedStock} onBack={handleBack} loading={loadingStock} watchlist={watchlist} toggleWatchlist={toggleWatchlist} />;
    }

    // Country detail view
    if (selectedCountry && activeTab === 'countries') {
      return <CountryDetail country={selectedCountry} onBack={handleBack} onSelectStock={handleSelectStock} loading={loadingCountry} />;
    }

    switch (activeTab) {
      case 'countries':
        return <CountryList countries={countries} onSelect={handleSelectCountry} searchQuery={searchQuery} />;
      case 'watchlist':
        return <WatchlistView watchlist={watchlist} onSelectStock={handleSelectStock} toggleWatchlist={toggleWatchlist} stockCache={stockCache} />;
      case 'portfolio':
        return <PortfolioView portfolio={portfolio} setPortfolio={setPortfolio} />;
      case 'search':
        return <SearchView searchQuery={searchQuery} onSelectStock={handleSelectStock} watchlist={watchlist} toggleWatchlist={toggleWatchlist} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#080c1a', paddingBottom: 70 }}>
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} loadProgress={loadProgress} />
      {renderContent()}
    </div>
  );
}

export default InvestScopeApp;