import { storage } from './storage';

const PORTFOLIO_KEY = 'portfolio';

export function getPortfolio() {
  return storage.get(PORTFOLIO_KEY) || { positions: [] };
}

export function savePortfolio(portfolio) {
  storage.set(PORTFOLIO_KEY, portfolio, null); // pas de TTL
}

export function addPosition({ symbol, name, exchange, avgCost, quantity, currency, tp, sl }) {
  const portfolio = getPortfolio();
  const position = {
    id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    symbol, name, exchange: exchange || '',
    avgCost: parseFloat(avgCost),
    quantity: parseFloat(quantity),
    currency: currency || 'EUR',
    currentPrice: null,
    tp: parseFloat(tp),
    sl: parseFloat(sl),
    tpHistory: [{ tp: parseFloat(tp), sl: parseFloat(sl), date: new Date().toISOString(), reason: 'Position initiale' }],
    addedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    aiSuggestion: null,
  };
  portfolio.positions.push(position);
  savePortfolio(portfolio);
  return position;
}

export function updatePosition(positionId, updates) {
  const portfolio = getPortfolio();
  const idx = portfolio.positions.findIndex(p => p.id === positionId);
  if (idx === -1) return null;
  portfolio.positions[idx] = { ...portfolio.positions[idx], ...updates, lastUpdated: new Date().toISOString() };
  savePortfolio(portfolio);
  return portfolio.positions[idx];
}

export function updateTPSL(positionId, newTP, newSL, reason = '') {
  const portfolio = getPortfolio();
  const pos = portfolio.positions.find(p => p.id === positionId);
  if (!pos) return null;
  pos.tp = parseFloat(newTP);
  pos.sl = parseFloat(newSL);
  pos.tpHistory.push({ tp: parseFloat(newTP), sl: parseFloat(newSL), date: new Date().toISOString(), reason });
  pos.lastUpdated = new Date().toISOString();
  savePortfolio(portfolio);
  return pos;
}

export function updateCurrentPrice(positionId, price) {
  const portfolio = getPortfolio();
  const pos = portfolio.positions.find(p => p.id === positionId);
  if (!pos) return;
  pos.currentPrice = parseFloat(price);
  pos.lastUpdated = new Date().toISOString();
  savePortfolio(portfolio);
}

export function removePosition(positionId) {
  const portfolio = getPortfolio();
  portfolio.positions = portfolio.positions.filter(p => p.id !== positionId);
  savePortfolio(portfolio);
}

export function calcPnL(position) {
  if (!position.currentPrice) return { pnlPercent: null, pnlAbsolute: null, totalValue: null };
  const pnlAbsolute = (position.currentPrice - position.avgCost) * position.quantity;
  const pnlPercent = ((position.currentPrice - position.avgCost) / position.avgCost) * 100;
  const totalValue = position.currentPrice * position.quantity;
  return {
    pnlAbsolute: Math.round(pnlAbsolute * 100) / 100,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
  };
}

export function calcPortfolioSummary(positions) {
  let totalValue = 0, totalCost = 0;
  let loaded = 0;
  positions.forEach(p => {
    if (p.currentPrice) {
      totalValue += p.currentPrice * p.quantity;
      totalCost += p.avgCost * p.quantity;
      loaded++;
    }
  });
  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalPnL: Math.round((totalValue - totalCost) * 100) / 100,
    totalPnLPercent: totalCost > 0 ? Math.round(((totalValue - totalCost) / totalCost) * 10000) / 100 : 0,
    loadedCount: loaded,
    totalCount: positions.length,
  };
}
