import { NextResponse } from 'next/server';

const FRED_KEY = process.env.FRED_API_KEY;

async function fetchJSON(url, timeout = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// FRED data (US mainly)
async function getFredSeries(seriesId, limit = 20) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const d = await fetchJSON(url);
  return d?.observations?.map(o => ({ date: o.date, value: parseFloat(o.value) || null })) || [];
}

// World Bank data (all countries)
async function getWorldBankIndicator(countryCode, indicator, mrv = 5) {
  const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrv=${mrv}&per_page=10`;
  const d = await fetchJSON(url);
  if (!d || !d[1]) return [];
  return d[1].map(e => ({ date: e.date, value: e.value })).filter(e => e.value !== null);
}

// IMF data
async function getIMFData(countryCode, indicator) {
  const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}/${countryCode}`;
  const d = await fetchJSON(url);
  if (!d?.values?.[indicator]?.[countryCode]) return [];
  const vals = d.values[indicator][countryCode];
  return Object.entries(vals).map(([year, val]) => ({ date: year, value: val })).slice(-10);
}

// Trading Economics style macro summary from World Bank
async function getCountryMacro(countryCode) {
  const indicators = {
    gdp: 'NY.GDP.MKTP.CD',
    gdpGrowth: 'NY.GDP.MKTP.KD.ZG',
    inflation: 'FP.CPI.TOTL.ZG',
    unemployment: 'SL.UEM.TOTL.ZS',
    currentAccount: 'BN.CAB.XOKA.GD.ZS',
    debtGDP: 'GC.DOD.TOTL.GD.ZS',
    tradeBalance: 'NE.RSB.GNFS.ZS',
    fdi: 'BX.KLT.DINV.WD.GD.ZS',
    popGrowth: 'SP.POP.GROW',
    gniPerCapita: 'NY.GNP.PCAP.CD',
    industryGDP: 'NV.IND.TOTL.ZS',
    servicesGDP: 'NV.SRV.TOTL.ZS',
    exportsGDP: 'NE.EXP.GNFS.ZS',
    domesticCredit: 'FS.AST.PRVT.GD.ZS',
    broadMoney: 'FM.LBL.BMNY.GD.ZS'
  };

  const promises = Object.entries(indicators).map(async ([key, ind]) => {
    const data = await getWorldBankIndicator(countryCode, ind, 6);
    return [key, data];
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

// FRED US-specific indicators
async function getUSMacro() {
  const series = {
    fedRate: 'FEDFUNDS',
    cpi: 'CPIAUCSL',
    pmi: 'MANEMP',
    unemployment: 'UNRATE',
    gdpGrowth: 'A191RL1Q225SBEA',
    tenYearYield: 'DGS10',
    twoYearYield: 'DGS2',
    sp500: 'SP500',
    housingStarts: 'HOUST',
    retailSales: 'RSXFS',
    industrialProd: 'INDPRO',
    consumerConfidence: 'UMCSENT',
    initialClaims: 'ICSA',
    m2: 'M2SL',
    buildPermits: 'PERMIT'
  };

  const promises = Object.entries(series).map(async ([key, id]) => {
    const data = await getFredSeries(id, 12);
    return [key, data];
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

export async function POST(request) {
  try {
    const { action, countryCode, indicator, seriesId } = await request.json();

    switch (action) {
      case 'country': {
        const data = await getCountryMacro(countryCode || 'US');
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'us': {
        const data = await getUSMacro();
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'worldbank': {
        const data = await getWorldBankIndicator(countryCode, indicator, 10);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'fred': {
        const data = await getFredSeries(seriesId, 20);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      case 'imf': {
        const data = await getIMFData(countryCode, indicator);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
