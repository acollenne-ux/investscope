'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { COUNTRY_DATA, PEA_COUNTRIES, cycleColors, cycleIcons, signalColors } from '../lib/constants';
import { storage } from '../lib/storage';
import { fetchCountryAnalysis, fetchStockAnalysis, searchStocks, fetchAISuggestedTPSL, fetchCurrentPrice } from '../lib/api';
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
        }}>{score?.toFixed(1)}</div>
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

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════

function NavBar({ activeTab, setActiveTab, searchQuery, setSearchQuery, loadProgress }) {
  return (
    <>
      {/* Header fixe en haut */}
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
        </div>
        {/* Barre de progression */}
        {loadProgress && loadProgress.total > 0 && loadProgress.done < loadProgress.total && (
          <div style={{ height: 3, background: '#1e293b' }}>
            <div style={{
              height: 3, background: '#3b82f6', borderRadius: '0 2px 2px 0',
              width: `${(loadProgress.done / loadProgress.total) * 100}%`,
              transition: 'width 0.5s ease'
            }} />
          </div>
        )}
      </div>

      {/* Barre d'onglets fixe en bas */}
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
// ONGLET PAYS
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

function CountryDetail({ country, onBack, onSelectStock, loading }) {
  return (
    <div style={{ padding: '0 12px' }} className="fade-in">
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 8,
          padding: '8px 12px', fontSize: 16
        }}>←</button>
        <span style={{ fontSize: 28 }}>{country.flag}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>{country.name}</h2>
          <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
            {PEA_COUNTRIES.includes(country.code) && <span style={{ fontSize: 9, background: '#3b82f622', color: '#60a5fa', padding: '1px 5px', borderRadius: 4 }}>PEA</span>}
            <span style={{ fontSize: 9, color: '#64748b' }}>Maj: {country.updated_at || '—'}</span>
          </div>
        </div>
        {country.overall_score != null && (
          <div style={{ fontSize: 24, fontWeight: 800, color: country.overall_score >= 7 ? '#22c55e' : country.overall_score >= 5 ? '#f59e0b' : '#ef4444' }}>
            {country.overall_score.toFixed(1)}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner text={`Analyse de ${country.name}...`} /> : (
        <>
          {/* Scores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { s: country.macro_score, l: 'Macro' },
              { s: country.geo_score, l: 'Géo' },
              { s: country.micro_score, l: 'Micro' },
              { s: country.sentiment_score, l: 'Sent.' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#0f172a', borderRadius: 10, padding: 10, textAlign: 'center', border: '1px solid #1e293b' }}>
                <ScoreBadge score={item.s} label={item.l} />
              </div>
            ))}
          </div>

          {/* Cycle */}
          {country.cycle && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>CYCLE ÉCONOMIQUE</div>
              <CycleBadge cycle={country.cycle} phase={country.cycle_phase} />
              {country.cycle_explanation && <p style={{ color: '#94a3b8', fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{country.cycle_explanation}</p>}
            </div>
          )}

          {/* Indicateurs macro */}
          <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>INDICATEURS MACROÉCONOMIQUES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                { label: 'Taux directeur', value: country.central_bank_rate != null ? `${country.central_bank_rate}%` : '—' },
                { label: 'Chômage', value: country.unemployment != null ? `${country.unemployment}%` : '—' },
                { label: 'Inflation CPI', value: country.inflation_cpi != null ? `${country.inflation_cpi}%` : '—' },
                { label: 'Inflation core', value: country.inflation_core != null ? `${country.inflation_core}%` : '—' },
                { label: 'PMI Manuf.', value: country.pmi_manufacturing || '—' },
                { label: 'PMI Services', value: country.pmi_services || '—' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e293b11' }}>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{item.label}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {country.gdp_growth_5y && Array.isArray(country.gdp_growth_5y) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>PIB 5 ans</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {country.gdp_growth_5y.map((g, i) => (
                    <div key={i} style={{
                      flex: 1, textAlign: 'center', padding: 4, borderRadius: 4,
                      background: g >= 0 ? '#22c55e11' : '#ef444411',
                      color: g >= 0 ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: 600
                    }}>{typeof g === 'number' ? `${g > 0 ? '+' : ''}${g}%` : g}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secteurs */}
          <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>SECTEURS À PRIVILÉGIER</div>
            {(country.sectors_buy || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: i < (country.sectors_buy?.length || 0) - 1 ? '1px solid #1e293b' : 'none' }}>
                <SignalBadge signal={s.signal} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                </div>
              </div>
            ))}
            {(country.sectors_sell || []).length > 0 && (
              <>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 10, marginBottom: 8, fontWeight: 600 }}>SECTEURS À ÉVITER</div>
                {(country.sectors_sell || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: i < (country.sectors_sell?.length || 0) - 1 ? '1px solid #1e293b' : 'none' }}>
                    <SignalBadge signal={s.signal} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ color: '#64748b', fontSize: 10 }}>{s.reason}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Top 5 actions */}
          <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>TOP 5 ACTIONS RECOMMANDÉES</div>
            {(country.top_stocks || []).map((stock, i) => (
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
                </div>
                <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>+{stock.estimated_growth}</div>
                <span style={{ color: '#3b82f6', fontSize: 14 }}>›</span>
              </button>
            ))}
          </div>

          {/* Actualités */}
          {country.news_summary && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📰 ACTUALITÉ & IMPACT</div>
              <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.6, margin: 0 }}>{country.news_summary}</p>
            </div>
          )}

          {country.score_explanation && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 10, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>💡 JUSTIFICATION</div>
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.6, margin: 0 }}>{country.score_explanation}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DÉTAIL ACTION
// ═══════════════════════════════════════════════════════════════

function StockDetail({ stock, onBack, loading, watchlist, toggleWatchlist }) {
  const inWatchlist = watchlist.some(w => w.symbol === stock.symbol);
  const probs = stock.tp && stock.sl && stock.price
    ? calcTPSLProbability(stock.price, stock.tp, stock.sl, stock.annual_volatility, stock.estimated_days)
    : { tpProb: stock.tp_probability, slProb: stock.sl_probability };

  return (
    <div style={{ padding: '0 12px' }} className="fade-in">
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: '#1e293b', border: 'none', color: '#94a3b8', borderRadius: 8, padding: '8px 12px', fontSize: 16 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 17 }}>{stock.symbol}</h2>
          <div style={{ color: '#64748b', fontSize: 11 }}>{stock.name}</div>
        </div>
        <button onClick={() => toggleWatchlist(stock)} style={{
          background: 'none', border: 'none', fontSize: 22, padding: 4
        }}>{inWatchlist ? '⭐' : '☆'}</button>
        {stock.price && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700 }}>{stock.price} {stock.currency}</div>
            <span style={{ fontSize: 9, color: '#64748b' }}>Maj: {stock.updated_at || '—'}</span>
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner text={`Analyse de ${stock.symbol}...`} /> : (
        <>
          {/* TP / SL */}
          {stock.tp && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginBottom: 3 }}>🎯 TAKE PROFIT</div>
                  <div style={{ fontSize: 20, color: '#22c55e', fontWeight: 800 }}>{stock.tp} {stock.currency}</div>
                  <div style={{ fontSize: 10, color: '#86efac' }}>+{stock.gain_pct}% • Proba: {probs.tpProb}%</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>~{stock.estimated_days}j estimés</div>
                </div>
                <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>🛑 STOP LOSS</div>
                  <div style={{ fontSize: 20, color: '#ef4444', fontWeight: 800 }}>{stock.sl} {stock.currency}</div>
                  <div style={{ fontSize: 10, color: '#fca5a5' }}>{stock.loss_pct}% • Proba: {probs.slProb}%</div>
                </div>
              </div>

              <PriceCursor currentPrice={stock.price} tp={stock.tp} sl={stock.sl} tpProb={probs.tpProb} slProb={probs.slProb} />
            </>
          )}

          {/* Ratio gain/perte */}
          {stock.gain_loss_ratio && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>RATIO GAIN/PERTE</div>
              <div style={{
                fontSize: 26, fontWeight: 800,
                color: stock.gain_loss_ratio >= 2 ? '#22c55e' : stock.gain_loss_ratio >= 1 ? '#f59e0b' : '#ef4444'
              }}>{stock.gain_loss_ratio?.toFixed(2)}x</div>
            </div>
          )}

          {/* Note globale */}
          {stock.overall_rating != null && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 12 }}>
              <ScoreBadge score={stock.overall_rating} label="Note" />
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5, margin: 0, flex: 1 }}>{stock.rating_explanation}</p>
            </div>
          )}

          {/* Dividende */}
          {stock.next_dividend_date && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>💰 PROCHAIN DIVIDENDE</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#e2e8f0', fontSize: 12 }}>{stock.next_dividend_date}</span>
                <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>{stock.next_dividend_pct}%</span>
              </div>
            </div>
          )}

          {/* Fondamentale */}
          <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>📊 ANALYSE FONDAMENTALE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
              {[
                { label: 'PER', value: stock.per },
                { label: 'PEG', value: stock.peg },
                { label: 'Payout', value: stock.payout_ratio ? `${stock.payout_ratio}%` : null },
                { label: 'ROIC-WACC', value: stock.roic_wacc ? `${stock.roic_wacc}%` : null },
                { label: 'Dettes/Actifs', value: stock.debt_assets ? `${stock.debt_assets}%` : null },
                { label: 'Levier', value: stock.leverage ? `${stock.leverage}x` : null },
                { label: 'Sharpe', value: stock.sharpe_ratio },
              ].filter(x => x.value != null).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{item.label}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {stock.fundamental_analysis && <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.5, margin: 0 }}>{stock.fundamental_analysis}</p>}
          </div>

          {/* Technique */}
          {stock.technical_analysis && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📈 ANALYSE TECHNIQUE</div>
              <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.5, margin: 0 }}>{stock.technical_analysis}</p>
            </div>
          )}

          {/* Méthodo TP/SL */}
          {stock.tp_sl_explanation && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>🎯 MÉTHODOLOGIE TP/SL</div>
              <p style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5, margin: 0 }}>{stock.tp_sl_explanation}</p>
            </div>
          )}

          {/* News */}
          {stock.news_summary && (
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📰 ACTUALITÉS</div>
              <p style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.5, margin: 0 }}>{stock.news_summary}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONGLET RECHERCHE IBKR-STYLE
// ═══════════════════════════════════════════════════════════════

function SearchView({ onSelectStock, watchlist, toggleWatchlist }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    const res = await searchStocks(q);
    setResults(res);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const flagMap = {};
  COUNTRY_DATA.forEach(c => { flagMap[c.code] = c.flag; });

  return (
    <div style={{ padding: '12px 12px' }}>
      <h3 style={{ color: '#e2e8f0', marginBottom: 10, fontSize: 15 }}>🔎 Rechercher une Action</h3>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ticker ou nom (ex: AAPL, LVMH, Samsung...)"
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10, background: '#1e293b',
          border: '1px solid #334155', color: '#e2e8f0', fontSize: 13, outline: 'none', marginBottom: 12
        }}
      />

      {searching && <LoadingSpinner text="Recherche..." />}

      {results.map((r, i) => {
        const inWl = watchlist.some(w => w.symbol === r.symbol);
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
            marginBottom: 4, borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b'
          }}>
            <button onClick={() => onSelectStock(r)} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', textAlign: 'left', padding: 0
            }}>
              <span style={{ fontSize: 18 }}>{flagMap[r.countryCode] || '🌐'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>{r.symbol}</span>
                  <span style={{ color: '#64748b', fontSize: 10, background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>{r.exchange}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name} • {r.sector}
                </div>
              </div>
              <span style={{ color: '#3b82f6', fontSize: 14 }}>›</span>
            </button>
            <button onClick={() => toggleWatchlist(r)} style={{
              background: 'none', border: 'none', fontSize: 20, padding: '4px 2px', color: inWl ? '#f59e0b' : '#475569'
            }}>{inWl ? '★' : '☆'}</button>
          </div>
        );
      })}

      {!searching && query.length >= 2 && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>Aucun résultat pour "{query}"</div>
      )}
      {!query && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>
          Tapez le nom ou le ticker d'une action pour la rechercher
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONGLET SUIVI (WATCHLIST)
// ═══════════════════════════════════════════════════════════════

function WatchlistView({ watchlist, onSelectStock, toggleWatchlist, stockCache }) {
  if (watchlist.length === 0) {
    return (
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <h3 style={{ color: '#e2e8f0', marginBottom: 16, fontSize: 15 }}>⭐ Ma Liste de Suivi</h3>
        <div style={{ padding: 30, color: '#64748b', fontSize: 12 }}>
          Ajoutez des actions depuis l'onglet Recherche en cliquant sur ☆
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px' }}>
      <h3 style={{ color: '#e2e8f0', marginBottom: 12, fontSize: 15 }}>⭐ Ma Liste de Suivi ({watchlist.length})</h3>
      {watchlist.map((item, i) => {
        const data = stockCache[item.symbol];
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px',
            marginBottom: 4, borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b'
          }}>
            <button onClick={() => onSelectStock(item)} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', textAlign: 'left', padding: 0
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{item.symbol}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{item.name} {item.exchange ? `• ${item.exchange}` : ''}</div>
              </div>
              {data?.price && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{data.price} {data.currency}</div>
                  {data.overall_rating && <ScoreBadge score={data.overall_rating} label="" />}
                </div>
              )}
              {!data && <div style={{ width: 16, height: 16, border: '2px solid #334155', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              <span style={{ color: '#3b82f6', fontSize: 14 }}>›</span>
            </button>
            <button onClick={() => toggleWatchlist(item)} style={{
              background: 'none', border: 'none', fontSize: 18, color: '#ef4444', padding: 4
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ONGLET PORTFOLIO
// ═══════════════════════════════════════════════════════════════

function PortfolioView({ portfolio, setPortfolio, onSelectStock }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingTPSL, setEditingTPSL] = useState(null);
  const [aiLoading, setAiLoading] = useState(null);
  const [form, setForm] = useState({ symbol: '', name: '', avgCost: '', quantity: '', currency: 'EUR', tp: '', sl: '' });
  const [tpslForm, setTpslForm] = useState({ tp: '', sl: '', reason: '' });

  const summary = calcPortfolioSummary(portfolio.positions);

  const handleAdd = () => {
    if (!form.symbol || !form.avgCost || !form.quantity || !form.tp || !form.sl) return;
    const pos = addPosition(form);
    setPortfolio(getPortfolio());
    setShowAdd(false);
    setForm({ symbol: '', name: '', avgCost: '', quantity: '', currency: 'EUR', tp: '', sl: '' });
    // Lancer le fetch du prix actuel
    fetchCurrentPrice(pos.symbol).then(data => {
      if (data?.price) {
        updateCurrentPrice(pos.id, data.price);
        setPortfolio(getPortfolio());
      }
    });
  };

  const handleUpdateTPSL = (posId) => {
    if (!tpslForm.tp || !tpslForm.sl) return;
    updateTPSL(posId, tpslForm.tp, tpslForm.sl, tpslForm.reason || 'Mise à jour manuelle');
    setPortfolio(getPortfolio());
    setEditingTPSL(null);
    setTpslForm({ tp: '', sl: '', reason: '' });
  };

  const handleAISuggestion = async (pos) => {
    setAiLoading(pos.id);
    const suggestion = await fetchAISuggestedTPSL(pos.symbol, pos.currentPrice || pos.avgCost, pos.avgCost, pos.quantity);
    if (suggestion) {
      updatePosition(pos.id, { aiSuggestion: suggestion });
      setPortfolio(getPortfolio());
    }
    setAiLoading(null);
  };

  const handleRemove = (posId) => {
    removePosition(posId);
    setPortfolio(getPortfolio());
  };

  return (
    <div style={{ padding: '12px' }}>
      <h3 style={{ color: '#e2e8f0', marginBottom: 10, fontSize: 15 }}>💼 Mon Portfolio</h3>

      {/* Résumé */}
      {portfolio.positions.length > 0 && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Valeur totale</span>
            <span style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700 }}>{summary.totalValue.toLocaleString('fr-FR')} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>Coût total</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{summary.totalCost.toLocaleString('fr-FR')} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 11 }}>P&L</span>
            <span style={{ color: summary.totalPnL >= 0 ? '#22c55e' : '#ef4444', fontSize: 14, fontWeight: 700 }}>
              {summary.totalPnL >= 0 ? '+' : ''}{summary.totalPnL.toLocaleString('fr-FR')} € ({summary.totalPnLPercent >= 0 ? '+' : ''}{summary.totalPnLPercent}%)
            </span>
          </div>
        </div>
      )}

      {/* Bouton ajouter */}
      <button onClick={() => setShowAdd(!showAdd)} style={{
        width: '100%', padding: '10px', borderRadius: 10, background: '#3b82f622',
        border: '1px solid #3b82f644', color: '#3b82f6', fontWeight: 600, fontSize: 13, marginBottom: 12
      }}>{showAdd ? '✕ Annuler' : '+ Ajouter une position'}</button>

      {/* Formulaire ajout */}
      {showAdd && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #3b82f644' }} className="slide-up">
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>NOUVELLE POSITION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="Symbole (ex: AAPL)" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
            <input placeholder="Nom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input placeholder="PRU" type="number" step="0.01" value={form.avgCost} onChange={e => setForm(f => ({ ...f, avgCost: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
            <input placeholder="Quantité" type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }} />
            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              style={{ padding: '8px 6px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 }}>
              <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              <option value="CHF">CHF</option><option value="JPY">JPY</option><option value="KRW">KRW</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <input placeholder="Take Profit" type="number" step="0.01" value={form.tp} onChange={e => setForm(f => ({ ...f, tp: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#22c55e11', border: '1px solid #22c55e33', color: '#22c55e', fontSize: 12 }} />
            <input placeholder="Stop Loss" type="number" step="0.01" value={form.sl} onChange={e => setForm(f => ({ ...f, sl: e.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, background: '#ef444411', border: '1px solid #ef444433', color: '#ef4444', fontSize: 12 }} />
          </div>
          <button onClick={handleAdd} style={{
            width: '100%', padding: '10px', borderRadius: 8, background: '#3b82f6',
            border: 'none', color: 'white', fontWeight: 600, fontSize: 13
          }}>Ajouter au portfolio</button>
        </div>
      )}

      {/* Positions */}
      {portfolio.positions.map(pos => {
        const pnl = calcPnL(pos);
        const probs = pos.currentPrice ? calcTPSLProbability(pos.currentPrice, pos.tp, pos.sl) : { tpProb: null, slProb: null };
        const isEditing = editingTPSL === pos.id;

        return (
          <div key={pos.id} style={{ background: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid #1e293b' }}>
            {/* Header position */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <button onClick={() => onSelectStock({ symbol: pos.symbol, name: pos.name })} style={{
                flex: 1, background: 'none', border: 'none', textAlign: 'left', padding: 0
              }}>
                <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{pos.symbol}</div>
                <div style={{ color: '#64748b', fontSize: 10 }}>{pos.name} • {pos.quantity} parts • PRU {pos.avgCost} {pos.currency}</div>
              </button>
              {pos.currentPrice && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700 }}>{pos.currentPrice} {pos.currency}</div>
                  <div style={{ color: pnl.pnlPercent >= 0 ? '#22c55e' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                    {pnl.pnlPercent >= 0 ? '+' : ''}{pnl.pnlPercent}% ({pnl.pnlAbsolute >= 0 ? '+' : ''}{pnl.pnlAbsolute})
                  </div>
                </div>
              )}
              {!pos.currentPrice && <div style={{ width: 16, height: 16, border: '2px solid #334155', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
            </div>

            {/* Curseur TP/SL */}
            {pos.currentPrice && <PriceCursor currentPrice={pos.currentPrice} tp={pos.tp} sl={pos.sl} tpProb={probs.tpProb} slProb={probs.slProb} avgCost={pos.avgCost} />}

            {/* Suggestion IA */}
            {pos.aiSuggestion && (
              <div style={{ background: '#3b82f611', border: '1px solid #3b82f633', borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>💡 SUGGESTION IA</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                  <span style={{ color: '#22c55e', fontSize: 11 }}>TP: {pos.aiSuggestion.suggested_tp} ({pos.aiSuggestion.tp_probability}%)</span>
                  <span style={{ color: '#ef4444', fontSize: 11 }}>SL: {pos.aiSuggestion.suggested_sl} ({pos.aiSuggestion.sl_probability}%)</span>
                  <span style={{ color: '#f59e0b', fontSize: 11 }}>R:R {pos.aiSuggestion.gain_loss_ratio?.toFixed(1)}x</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.4, margin: 0 }}>{pos.aiSuggestion.reasoning}</p>
                <button onClick={() => {
                  updateTPSL(pos.id, pos.aiSuggestion.suggested_tp, pos.aiSuggestion.suggested_sl, 'Suggestion IA acceptée');
                  updatePosition(pos.id, { aiSuggestion: null });
                  setPortfolio(getPortfolio());
                }} style={{
                  marginTop: 6, padding: '5px 12px', borderRadius: 6, background: '#3b82f633',
                  border: 'none', color: '#3b82f6', fontSize: 11, fontWeight: 600
                }}>Appliquer cette suggestion</button>
              </div>
            )}

            {/* Edition TP/SL */}
            {isEditing && (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: 10, marginTop: 6 }} className="slide-up">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <input placeholder={`TP actuel: ${pos.tp}`} type="number" step="0.01" value={tpslForm.tp} onChange={e => setTpslForm(f => ({ ...f, tp: e.target.value }))}
                    style={{ padding: '6px 8px', borderRadius: 6, background: '#22c55e11', border: '1px solid #22c55e33', color: '#22c55e', fontSize: 11 }} />
                  <input placeholder={`SL actuel: ${pos.sl}`} type="number" step="0.01" value={tpslForm.sl} onChange={e => setTpslForm(f => ({ ...f, sl: e.target.value }))}
                    style={{ padding: '6px 8px', borderRadius: 6, background: '#ef444411', border: '1px solid #ef444433', color: '#ef4444', fontSize: 11 }} />
                </div>
                <input placeholder="Raison du changement..." value={tpslForm.reason} onChange={e => setTpslForm(f => ({ ...f, reason: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', fontSize: 11, marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleUpdateTPSL(pos.id)} style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#3b82f6', border: 'none', color: 'white', fontSize: 11, fontWeight: 600 }}>Valider</button>
                  <button onClick={() => setEditingTPSL(null)} style={{ padding: '6px 12px', borderRadius: 6, background: '#334155', border: 'none', color: '#94a3b8', fontSize: 11 }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Historique TP/SL */}
            {pos.tpHistory && pos.tpHistory.length > 1 && !isEditing && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ color: '#64748b', fontSize: 10, cursor: 'pointer' }}>Historique TP/SL ({pos.tpHistory.length} modifications)</summary>
                <div style={{ marginTop: 4 }}>
                  {pos.tpHistory.slice().reverse().map((h, hi) => (
                    <div key={hi} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b22', fontSize: 10 }}>
                      <span style={{ color: '#94a3b8' }}>{new Date(h.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ color: '#22c55e' }}>TP {h.tp}</span>
                      <span style={{ color: '#ef4444' }}>SL {h.sl}</span>
                      <span style={{ color: '#64748b', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => { setEditingTPSL(pos.id); setTpslForm({ tp: '', sl: '', reason: '' }); }}
                style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#334155', border: 'none', color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>
                ✏️ Modifier TP/SL
              </button>
              <button onClick={() => handleAISuggestion(pos)} disabled={aiLoading === pos.id}
                style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#3b82f622', border: 'none', color: '#3b82f6', fontSize: 10, fontWeight: 600 }}>
                {aiLoading === pos.id ? '⏳...' : '🤖 Suggestion IA'}
              </button>
              <button onClick={() => handleRemove(pos.id)}
                style={{ padding: '6px 10px', borderRadius: 6, background: '#ef444422', border: 'none', color: '#ef4444', fontSize: 10 }}>
                🗑️
              </button>
            </div>
          </div>
        );
      })}

      {portfolio.positions.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: 12 }}>
          Ajoutez vos premières positions pour suivre votre portfolio
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION PRINCIPALE
// ═══════════════════════════════════════════════════════════════

export default function InvestScopeApp() {
  const [activeTab, setActiveTab] = useState('countries');
  const [subView, setSubView] = useState(null); // 'countryDetail' | 'stockDetail'
  const [searchQuery, setSearchQuery] = useState('');
  const [countries, setCountries] = useState(COUNTRY_DATA.map(c => ({ ...c, overall_score: null })));
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockOrigin, setStockOrigin] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [countryLoading, setCountryLoading] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState({ positions: [] });
  const [stockCache, setStockCache] = useState({});
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0, phase: 'idle' });
  const autoLoadRef = useRef(false);

  // Charger données persistées au démarrage
  useEffect(() => {
    // Charger cache pays
    const cachedCountries = storage.get('countries_index');
    if (cachedCountries) {
      setCountries(prev => prev.map(c => {
        const found = cachedCountries.find(x => x.code === c.code);
        return found ? { ...c, ...found } : c;
      }));
    }
    // Charger watchlist
    const wl = storage.get('watchlist');
    if (wl) setWatchlist(wl);
    // Charger portfolio
    setPortfolio(getPortfolio());
    // Charger cache stocks
    const sc = storage.get('stock_cache_index');
    if (sc) setStockCache(sc);
  }, []);

  // Auto-loader des pays en arrière-plan
  useEffect(() => {
    if (autoLoadRef.current) return;
    autoLoadRef.current = true;

    const autoLoad = async () => {
      const toAnalyze = COUNTRY_DATA.filter(c => {
        const cached = storage.get(`country_${c.code}`);
        return !cached;
      });

      if (toAnalyze.length === 0) {
        // Tout est en cache, charger les données
        const allData = COUNTRY_DATA.map(c => {
          const cached = storage.get(`country_${c.code}`);
          return cached ? { ...c, ...cached } : c;
        });
        setCountries(allData);

        // Phase 2: charger les stocks des watchlists + top stocks
        await autoLoadStocks(allData);
        return;
      }

      setLoadProgress({ done: 0, total: toAnalyze.length, phase: 'countries' });

      for (let i = 0; i < toAnalyze.length; i += 3) {
        const batch = toAnalyze.slice(i, i + 3);
        const results = await Promise.allSettled(
          batch.map(c => fetchCountryAnalysis(c.name, c.code))
        );

        setCountries(prev => {
          const updated = [...prev];
          batch.forEach((c, j) => {
            const result = results[j];
            if (result.status === 'fulfilled' && result.value) {
              const idx = updated.findIndex(x => x.code === c.code);
              if (idx >= 0) updated[idx] = { ...updated[idx], ...result.value };
            }
          });
          // Sauvegarder l'index
          storage.set('countries_index', updated.filter(c => c.overall_score));
          return updated;
        });

        setLoadProgress(p => ({ ...p, done: Math.min(i + 3, toAnalyze.length) }));

        // Pause entre batches
        if (i + 3 < toAnalyze.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      setLoadProgress(p => ({ ...p, phase: 'stocks' }));

      // Phase 2: charger les stocks
      const allData = COUNTRY_DATA.map(c => {
        const cached = storage.get(`country_${c.code}`);
        return cached ? { ...c, ...cached } : c;
      });
      await autoLoadStocks(allData);
      setLoadProgress({ done: 0, total: 0, phase: 'idle' });
    };

    const autoLoadStocks = async (countriesData) => {
      // Collecter tous les stocks à analyser (top stocks des pays + watchlist)
      const stocksToLoad = new Set();
      countriesData.forEach(c => {
        (c.top_stocks || []).forEach(s => stocksToLoad.add(JSON.stringify({ symbol: s.symbol, name: s.name, country: c.name })));
      });
      const wl = storage.get('watchlist') || [];
      wl.forEach(w => stocksToLoad.add(JSON.stringify({ symbol: w.symbol, name: w.name || w.symbol, country: w.country || 'Mondial' })));

      const stockList = [...stocksToLoad].map(s => JSON.parse(s)).filter(s => !storage.get(`stock_${s.symbol}`));

      if (stockList.length === 0) return;

      setLoadProgress({ done: 0, total: stockList.length, phase: 'stocks' });

      for (let i = 0; i < stockList.length; i += 3) {
        const batch = stockList.slice(i, i + 3);
        const results = await Promise.allSettled(
          batch.map(s => fetchStockAnalysis(s.symbol, s.name, s.country))
        );

        const newCache = { ...stockCache };
        batch.forEach((s, j) => {
          if (results[j].status === 'fulfilled' && results[j].value) {
            newCache[s.symbol] = results[j].value;
          }
        });
        setStockCache(newCache);
        storage.set('stock_cache_index', newCache);

        setLoadProgress(p => ({ ...p, done: Math.min(i + 3, stockList.length) }));

        if (i + 3 < stockList.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };

    // Lancer avec un léger délai pour ne pas bloquer le rendu initial
    setTimeout(autoLoad, 500);
  }, []);

  // Charger les prix du portfolio
  useEffect(() => {
    const loadPrices = async () => {
      const positions = portfolio.positions.filter(p => !p.currentPrice);
      for (const pos of positions) {
        const data = await fetchCurrentPrice(pos.symbol);
        if (data?.price) {
          updateCurrentPrice(pos.id, data.price);
          setPortfolio(getPortfolio());
        }
      }
    };
    if (portfolio.positions.length > 0) loadPrices();
  }, [portfolio.positions.length]);

  // Toggle watchlist
  const toggleWatchlist = useCallback((stock) => {
    setWatchlist(prev => {
      const exists = prev.findIndex(w => w.symbol === stock.symbol);
      let updated;
      if (exists >= 0) {
        updated = prev.filter((_, i) => i !== exists);
      } else {
        updated = [...prev, { symbol: stock.symbol, name: stock.name, exchange: stock.exchange, country: stock.country, countryCode: stock.countryCode, addedAt: new Date().toISOString() }];
      }
      storage.set('watchlist', updated, null);
      return updated;
    });
  }, []);

  // Sélectionner un pays
  const selectCountry = async (country) => {
    setSelectedCountry(country);
    setSubView('countryDetail');
    if (!country.sectors_buy) {
      setCountryLoading(true);
      const data = await fetchCountryAnalysis(country.name, country.code);
      if (data) {
        const updated = { ...country, ...data };
        setSelectedCountry(updated);
        setCountries(prev => prev.map(c => c.code === country.code ? updated : c));
      }
      setCountryLoading(false);
    }
  };

  // Sélectionner un stock
  const selectStock = async (stock, origin = 'search') => {
    setSelectedStock(stock);
    setStockOrigin(origin);
    setSubView('stockDetail');

    // Vérifier cache
    const cached = stockCache[stock.symbol] || storage.get(`stock_${stock.symbol}`);
    if (cached) {
      setSelectedStock(prev => ({ ...prev, ...cached }));
      return;
    }

    setStockLoading(true);
    const data = await fetchStockAnalysis(stock.symbol, stock.name, selectedCountry?.name || stock.country || 'Mondial');
    if (data) {
      setSelectedStock(prev => ({ ...prev, ...data }));
      setStockCache(prev => {
        const updated = { ...prev, [stock.symbol]: data };
        storage.set('stock_cache_index', updated);
        return updated;
      });
    }
    setStockLoading(false);
  };

  // Navigation retour
  const goBack = () => {
    if (subView === 'stockDetail') {
      if (stockOrigin === 'country') setSubView('countryDetail');
      else setSubView(null);
      setSelectedStock(null);
    } else if (subView === 'countryDetail') {
      setSubView(null);
      setSelectedCountry(null);
    }
  };

  // Recherche globale depuis la barre du haut
  useEffect(() => {
    if (searchQuery && activeTab === 'countries') {
      // Filtrage géré par CountryList
    } else if (searchQuery && !['search'].includes(activeTab)) {
      setActiveTab('search');
    }
  }, [searchQuery]);

  return (
    <div style={{ paddingBottom: 70 }}>
      <NavBar activeTab={subView ? null : activeTab} setActiveTab={(tab) => { setSubView(null); setActiveTab(tab); setSelectedCountry(null); setSelectedStock(null); }} searchQuery={searchQuery} setSearchQuery={setSearchQuery} loadProgress={loadProgress} />

      {/* Sous-vues (détail pays / détail stock) */}
      {subView === 'countryDetail' && selectedCountry && (
        <CountryDetail
          country={selectedCountry}
          onBack={goBack}
          onSelectStock={(s) => selectStock(s, 'country')}
          loading={countryLoading}
        />
      )}

      {subView === 'stockDetail' && selectedStock && (
        <StockDetail
          stock={selectedStock}
          onBack={goBack}
          loading={stockLoading}
          watchlist={watchlist}
          toggleWatchlist={toggleWatchlist}
        />
      )}

      {/* Onglets principaux */}
      {!subView && activeTab === 'countries' && (
        <CountryList countries={countries} onSelect={selectCountry} searchQuery={searchQuery} />
      )}

      {!subView && activeTab === 'watchlist' && (
        <WatchlistView watchlist={watchlist} onSelectStock={(s) => selectStock(s, 'watchlist')} toggleWatchlist={toggleWatchlist} stockCache={stockCache} />
      )}

      {!subView && activeTab === 'portfolio' && (
        <PortfolioView portfolio={portfolio} setPortfolio={setPortfolio} onSelectStock={(s) => selectStock(s, 'portfolio')} />
      )}

      {!subView && activeTab === 'search' && (
        <SearchView onSelectStock={(s) => selectStock(s, 'search')} watchlist={watchlist} toggleWatchlist={toggleWatchlist} />
      )}
    </div>
  );
}
