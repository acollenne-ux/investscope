import { NextResponse } from 'next/server';

const FRED_KEY = process.env.FRED_API_KEY;
const FMP = process.env.FMP_API_KEY;

async function fetchJSON(url, timeout = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

// ═══════════════════════════════════════════════════════════
// WORLD BANK DATA (all countries, historical)
// ═══════════════════════════════════════════════════════════
async function getWorldBankIndicator(countryCode, indicator, mrv = 5) {
  const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrv=${mrv}&per_page=10`;
  const d = await fetchJSON(url);
  if (!d || !d[1]) return [];
  return d[1].map(e => ({ date: e.date, value: e.value })).filter(e => e.value !== null);
}

// ═══════════════════════════════════════════════════════════
// IMF WEO (World Economic Outlook) — GDP FORECASTS + MORE
// Real IMF DataMapper API for institutional-grade data
// ═══════════════════════════════════════════════════════════
async function getIMFData(countryCode, indicator) {
  const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}/${countryCode}`;
  const d = await fetchJSON(url, 12000);
  if (!d?.values?.[indicator]?.[countryCode]) return [];
  const vals = d.values[indicator][countryCode];
  return Object.entries(vals).map(([year, val]) => ({ date: year, value: val })).sort((a, b) => parseInt(a.date) - parseInt(b.date));
}

// Full IMF WEO dataset for a country — institutional grade
async function getIMFCountryFull(countryCode) {
  const indicators = {
    // GDP & Growth
    gdpGrowth: 'NGDP_RPCH',        // Real GDP growth (annual %)
    gdpNominal: 'NGDPD',            // GDP nominal (USD billions)
    gdpPerCapitaPPP: 'PPPPC',       // GDP per capita PPP (current $)
    outputGap: 'NGAP_NPGDP',        // Output gap (% of potential GDP)
    // Prices & Inflation
    inflationCPI: 'PCPIPCH',        // CPI inflation (annual %)
    inflationEnd: 'PCPIEPCH',       // CPI end of period
    // Government & Fiscal
    govDebtGDP: 'GGXWDG_NGDP',     // Government debt (% GDP)
    govBalance: 'GGXCNL_NGDP',     // Government balance (% GDP)
    govRevenue: 'GGR_NGDP',        // Revenue (% GDP)
    govExpenditure: 'GGX_NGDP',    // Expenditure (% GDP)
    // External
    currentAccount: 'BCA_NGDPD',   // Current account (% GDP)
    // Employment
    unemployment: 'LUR',            // Unemployment rate (%)
    // Population
    population: 'LP',               // Population (millions)
  };

  const promises = Object.entries(indicators).map(async ([key, ind]) => {
    try {
      const data = await getIMFData(countryCode, ind);
      return [key, data];
    } catch { return [key, []]; }
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

// Extract GDP forecasts (past 3 years + future 3-5 years)
function extractGDPForecasts(imfData) {
  const gdpGrowth = imfData?.gdpGrowth || [];
  const currentYear = new Date().getFullYear();
  // Get years from currentYear-3 to currentYear+5
  const relevant = gdpGrowth.filter(d => {
    const y = parseInt(d.date);
    return y >= currentYear - 3 && y <= currentYear + 5;
  });
  return relevant.map(d => ({
    year: d.date,
    value: d.value,
    isForecast: parseInt(d.date) >= currentYear
  }));
}

// ═══════════════════════════════════════════════════════════
// FRED DATA (US + global macro)
// ═══════════════════════════════════════════════════════════
async function getFredSeries(seriesId, limit = 20) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const d = await fetchJSON(url);
  return d?.observations?.map(o => ({ date: o.date, value: parseFloat(o.value) || null })) || [];
}

// ═══════════════════════════════════════════════════════════
// FMP Economic Calendar & Indicators
// ═══════════════════════════════════════════════════════════
async function getFMPEconomicCalendar(from, to) {
  if (!FMP) return [];
  const url = `https://financialmodelingprep.com/stable/economic-calendar?from=${from}&to=${to}&apikey=${FMP}`;
  const d = await fetchJSON(url);
  return Array.isArray(d) ? d : [];
}

// ═══════════════════════════════════════════════════════════
// COMPOSITE: Full country macro data (World Bank + IMF WEO)
// ═══════════════════════════════════════════════════════════
async function getCountryMacro(countryCode) {
  // World Bank indicators (historical, reliable)
  const wbIndicators = {
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
    broadMoney: 'FM.LBL.BMNY.GD.ZS',
    // Additional cycle indicators
    grossCapitalFormation: 'NE.GDI.TOTL.ZS',      // Investment % GDP
    shortTermDebtReserves: 'DT.DOD.DSTC.IR.ZS',   // ST debt / reserves
    realInterestRate: 'FR.INR.RINR',               // Real interest rate
    stocksTraded: 'CM.MKT.TRAD.GD.ZS',            // Stock turnover % GDP
    taxRevenue: 'GC.TAX.TOTL.GD.ZS',              // Tax revenue % GDP
  };

  const wbPromises = Object.entries(wbIndicators).map(async ([key, ind]) => {
    const data = await getWorldBankIndicator(countryCode, ind, 8);
    return [key, data];
  });

  // IMF WEO data (includes forecasts!)
  const [wbResults, imfData] = await Promise.all([
    Promise.all(wbPromises),
    getIMFCountryFull(countryCode)
  ]);

  const worldBank = Object.fromEntries(wbResults);
  const gdpForecasts = extractGDPForecasts(imfData);

  return {
    worldBank,
    imf: imfData,
    gdpForecasts,
  };
}

// FRED US-specific deep indicators for cycle analysis
async function getUSMacro() {
  const series = {
    fedRate: 'FEDFUNDS',
    cpi: 'CPIAUCSL',
    corePCE: 'PCEPILFE',
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
    buildPermits: 'PERMIT',
    // Additional cycle indicators
    yieldSpread: 'T10Y2Y',           // 10Y-2Y spread (recession predictor)
    leIndex: 'USSLIND',              // Leading Economic Index
    businessInventories: 'BUSINV',   // Business inventories
    capacityUtilization: 'TCU',      // Capacity utilization
    nonFarmPayrolls: 'PAYEMS',       // Non-farm payrolls
    coreInflation: 'CPILFESL',       // Core CPI
    corporateProfits: 'CP',          // Corporate profits
    realDisposableIncome: 'DSPIC96', // Real disposable income
  };

  const promises = Object.entries(series).map(async ([key, id]) => {
    const data = await getFredSeries(id, 24);
    return [key, data];
  });

  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

export async function POST(request) {
  try {
    const { action, countryCode, indicator, seriesId, from, to } = await request.json();

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
      case 'imf_full': {
        const data = await getIMFCountryFull(countryCode);
        const gdpForecasts = extractGDPForecasts(data);
        return NextResponse.json({ success: true, data: { imf: data, gdpForecasts }, updatedAt: new Date().toISOString() });
      }
      case 'economic_calendar': {
        const data = await getFMPEconomicCalendar(from, to);
        return NextResponse.json({ success: true, data, updatedAt: new Date().toISOString() });
      }
      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
