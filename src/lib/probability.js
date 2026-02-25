// Calcul professionnel des probabilités TP/SL
// Modèle: Mouvement Brownien Géométrique (GBM) avec barrières doubles

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1.0 + sign * y);
}

export function calcTPSLProbability(currentPrice, tp, sl, annualVolatility = null, days = 60, annualDrift = 0.08) {
  if (!currentPrice || !tp || !sl || tp <= sl) return { tpProb: 50, slProb: 50 };

  if (!annualVolatility) {
    const tpReturn = Math.abs(Math.log(tp / currentPrice));
    const slReturn = Math.abs(Math.log(sl / currentPrice));
    const avgReturn = (tpReturn + slReturn) / 2;
    const dailyVol = avgReturn / (1.5 * Math.sqrt(days / 252));
    annualVolatility = dailyVol * Math.sqrt(252);
  }

  const sigma = annualVolatility;
  const mu = annualDrift - 0.5 * sigma * sigma;
  const a = Math.log(sl / currentPrice);
  const b = Math.log(tp / currentPrice);
  const range = b - a;

  if (range <= 0) return { tpProb: 50, slProb: 50 };

  if (Math.abs(mu) > 0.001) {
    const factor = 2 * mu / (sigma * sigma);
    const expA = Math.exp(-factor * a);
    const expB = Math.exp(-factor * b);
    const denom = expB - expA;
    if (Math.abs(denom) < 1e-10) return { tpProb: 50, slProb: 50 };
    const pTP = Math.max(0, Math.min(1, (1 - expA) / denom));
    return { tpProb: Math.round(pTP * 100), slProb: Math.round((1 - pTP) * 100) };
  }

  const pTP = Math.abs(a) / range;
  return { tpProb: Math.round(pTP * 100), slProb: Math.round((1 - pTP) * 100) };
}

export function calcCursorPosition(currentPrice, tp, sl) {
  if (!tp || !sl || tp === sl) return 50;
  const position = ((currentPrice - sl) / (tp - sl)) * 100;
  return Math.max(-5, Math.min(105, position));
}
