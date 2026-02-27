export const PEA_COUNTRIES = [
  "FR","DE","IT","ES","PT","NL","BE","AT","FI","IE","GR","LU","MT","CY",
  "SK","SI","EE","LV","LT","SE","DK","NO","IS","PL","CZ","HU","RO","BG","HR","LI","GB"
];

// Object keyed by ISO code (was array before — fixed for Object.entries() usage in page.js)
export const COUNTRY_DATA = {
  "KR": { name: "Corée du Sud", flag: "🇰🇷", region: "Asie" },
  "IN": { name: "Inde", flag: "🇮🇳", region: "Asie" },
  "ID": { name: "Indonésie", flag: "🇮🇩", region: "Asie" },
  "MY": { name: "Malaisie", flag: "🇲🇾", region: "Asie" },
  "PH": { name: "Philippines", flag: "🇵🇭", region: "Asie" },
  "TH": { name: "Thaïlande", flag: "🇹🇭", region: "Asie" },
  "VN": { name: "Vietnam", flag: "🇻🇳", region: "Asie" },
  "CN": { name: "Chine", flag: "🇨🇳", region: "Asie" },
  "JP": { name: "Japon", flag: "🇯🇵", region: "Asie" },
  "TW": { name: "Taïwan", flag: "🇹🇼", region: "Asie" },
  "SG": { name: "Singapour", flag: "🇸🇬", region: "Asie" },
  "HK": { name: "Hong Kong", flag: "🇭🇰", region: "Asie" },
  "US": { name: "États-Unis", flag: "🇺🇸", region: "Amérique" },
  "BR": { name: "Brésil", flag: "🇧🇷", region: "Amérique" },
  "MX": { name: "Mexique", flag: "🇲🇽", region: "Amérique" },
  "AR": { name: "Argentine", flag: "🇦🇷", region: "Amérique" },
  "CL": { name: "Chili", flag: "🇨🇱", region: "Amérique" },
  "CO": { name: "Colombie", flag: "🇨🇴", region: "Amérique" },
  "PE": { name: "Pérou", flag: "🇵🇪", region: "Amérique" },
  "GB": { name: "Royaume-Uni", flag: "🇬🇧", region: "Europe" },
  "DE": { name: "Allemagne", flag: "🇩🇪", region: "Europe" },
  "FR": { name: "France", flag: "🇫🇷", region: "Europe" },
  "SE": { name: "Suède", flag: "🇸🇪", region: "Europe" },
  "NO": { name: "Norvège", flag: "🇳🇴", region: "Europe" },
  "DK": { name: "Danemark", flag: "🇩🇰", region: "Europe" },
  "FI": { name: "Finlande", flag: "🇫🇮", region: "Europe" },
  "NL": { name: "Pays-Bas", flag: "🇳🇱", region: "Europe" },
  "BE": { name: "Belgique", flag: "🇧🇪", region: "Europe" },
  "IT": { name: "Italie", flag: "🇮🇹", region: "Europe" },
  "ES": { name: "Espagne", flag: "🇪🇸", region: "Europe" },
  "PT": { name: "Portugal", flag: "🇵🇹", region: "Europe" },
  "GR": { name: "Grèce", flag: "🇬🇷", region: "Europe" },
  "PL": { name: "Pologne", flag: "🇵🇱", region: "Europe" },
  "CZ": { name: "Tchéquie", flag: "🇨🇿", region: "Europe" },
  "HU": { name: "Hongrie", flag: "🇭🇺", region: "Europe" },
  "RO": { name: "Roumanie", flag: "🇷🇴", region: "Europe" },
  "BG": { name: "Bulgarie", flag: "🇧🇬", region: "Europe" },
  "HR": { name: "Croatie", flag: "🇭🇷", region: "Europe" },
  "RS": { name: "Serbie", flag: "🇷🇸", region: "Europe" },
  "TR": { name: "Turquie", flag: "🇹🇷", region: "Europe" },
  "AT": { name: "Autriche", flag: "🇦🇹", region: "Europe" },
  "CH": { name: "Suisse", flag: "🇨🇭", region: "Europe" },
  "IE": { name: "Irlande", flag: "🇮🇪", region: "Europe" },
  "AU": { name: "Australie", flag: "🇦🇺", region: "Océanie" },
  "NZ": { name: "Nouvelle-Zélande", flag: "🇳🇿", region: "Océanie" },
  "ZA": { name: "Afrique du Sud", flag: "🇿🇦", region: "Afrique" },
  "NG": { name: "Nigeria", flag: "🇳🇬", region: "Afrique" },
  "EG": { name: "Égypte", flag: "🇪🇬", region: "Afrique" },
  "MA": { name: "Maroc", flag: "🇲🇦", region: "Afrique" },
  "KE": { name: "Kenya", flag: "🇰🇪", region: "Afrique" },
  "SA": { name: "Arabie Saoudite", flag: "🇸🇦", region: "Moyen-Orient" },
  "AE": { name: "Émirats Arabes Unis", flag: "🇦🇪", region: "Moyen-Orient" },
  "QA": { name: "Qatar", flag: "🇶🇦", region: "Moyen-Orient" },
  "IL": { name: "Israël", flag: "🇮🇱", region: "Moyen-Orient" },
  "RU": { name: "Russie", flag: "🇷🇺", region: "Europe" },
};

export const cycleColors = { "Expansion": "#22c55e", "Pic": "#f59e0b", "Récession": "#ef4444", "Rebond": "#3b82f6" };
export const cycleIcons = { "Expansion": "📈", "Pic": "🔝", "Récession": "📉", "Rebond": "🔄" };

export const signalColors = {
  "ACHETER FORT": { bg: "#15803d", color: "#bbf7d0" },
  "ACHETER": { bg: "#166534", color: "#86efac" },
  "CONSERVER": { bg: "#854d0e", color: "#fde68a" },
  "VENDRE": { bg: "#991b1b", color: "#fca5a5" },
  "VENDRE FORT": { bg: "#7f1d1d", color: "#fecaca" },
};

// Exchange mapping for country stock screeners
export const COUNTRY_EXCHANGES = {
  "US": "NYSE", "FR": "PAR", "DE": "XETRA", "GB": "LSE", "JP": "TSE",
  "KR": "KSC", "CN": "SHH", "HK": "HKG", "IN": "NSE", "BR": "SAO",
  "AU": "ASX", "CH": "SWX", "NL": "AMS", "IT": "MIL", "ES": "BME",
  "SE": "STO", "NO": "OSL", "DK": "CPH", "FI": "HEL", "SG": "SGX",
  "TW": "TWO", "MX": "BMV", "ZA": "JNB", "SA": "SAU", "IL": "TLV",
  "TR": "IST", "PL": "WAR", "AT": "VIE", "BE": "BRU", "PT": "LIS",
  "IE": "ISE", "GR": "ATH", "NZ": "NZE",
};
