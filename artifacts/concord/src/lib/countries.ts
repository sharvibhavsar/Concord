// Comprehensive country list with primary timezones
export interface Country {
  name: string;
  code: string;
  timezones: string[];
}

export const COUNTRIES: Country[] = [
  { name: "Afghanistan", code: "AF", timezones: ["Asia/Kabul"] },
  { name: "Albania", code: "AL", timezones: ["Europe/Tirane"] },
  { name: "Algeria", code: "DZ", timezones: ["Africa/Algiers"] },
  { name: "Argentina", code: "AR", timezones: ["America/Argentina/Buenos_Aires", "America/Argentina/Cordoba"] },
  { name: "Armenia", code: "AM", timezones: ["Asia/Yerevan"] },
  { name: "Australia", code: "AU", timezones: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide"] },
  { name: "Austria", code: "AT", timezones: ["Europe/Vienna"] },
  { name: "Azerbaijan", code: "AZ", timezones: ["Asia/Baku"] },
  { name: "Bahrain", code: "BH", timezones: ["Asia/Bahrain"] },
  { name: "Bangladesh", code: "BD", timezones: ["Asia/Dhaka"] },
  { name: "Belarus", code: "BY", timezones: ["Europe/Minsk"] },
  { name: "Belgium", code: "BE", timezones: ["Europe/Brussels"] },
  { name: "Bolivia", code: "BO", timezones: ["America/La_Paz"] },
  { name: "Bosnia and Herzegovina", code: "BA", timezones: ["Europe/Sarajevo"] },
  { name: "Brazil", code: "BR", timezones: ["America/Sao_Paulo", "America/Manaus", "America/Belem"] },
  { name: "Bulgaria", code: "BG", timezones: ["Europe/Sofia"] },
  { name: "Cambodia", code: "KH", timezones: ["Asia/Phnom_Penh"] },
  { name: "Cameroon", code: "CM", timezones: ["Africa/Douala"] },
  { name: "Canada", code: "CA", timezones: ["America/Toronto", "America/Vancouver", "America/Winnipeg", "America/Edmonton", "America/Halifax"] },
  { name: "Chile", code: "CL", timezones: ["America/Santiago"] },
  { name: "China", code: "CN", timezones: ["Asia/Shanghai", "Asia/Chongqing"] },
  { name: "Colombia", code: "CO", timezones: ["America/Bogota"] },
  { name: "Croatia", code: "HR", timezones: ["Europe/Zagreb"] },
  { name: "Cuba", code: "CU", timezones: ["America/Havana"] },
  { name: "Cyprus", code: "CY", timezones: ["Asia/Nicosia"] },
  { name: "Czech Republic", code: "CZ", timezones: ["Europe/Prague"] },
  { name: "Denmark", code: "DK", timezones: ["Europe/Copenhagen"] },
  { name: "Dominican Republic", code: "DO", timezones: ["America/Santo_Domingo"] },
  { name: "Ecuador", code: "EC", timezones: ["America/Guayaquil"] },
  { name: "Egypt", code: "EG", timezones: ["Africa/Cairo"] },
  { name: "Estonia", code: "EE", timezones: ["Europe/Tallinn"] },
  { name: "Ethiopia", code: "ET", timezones: ["Africa/Addis_Ababa"] },
  { name: "Finland", code: "FI", timezones: ["Europe/Helsinki"] },
  { name: "France", code: "FR", timezones: ["Europe/Paris"] },
  { name: "Georgia", code: "GE", timezones: ["Asia/Tbilisi"] },
  { name: "Germany", code: "DE", timezones: ["Europe/Berlin"] },
  { name: "Ghana", code: "GH", timezones: ["Africa/Accra"] },
  { name: "Greece", code: "GR", timezones: ["Europe/Athens"] },
  { name: "Guatemala", code: "GT", timezones: ["America/Guatemala"] },
  { name: "Honduras", code: "HN", timezones: ["America/Tegucigalpa"] },
  { name: "Hong Kong", code: "HK", timezones: ["Asia/Hong_Kong"] },
  { name: "Hungary", code: "HU", timezones: ["Europe/Budapest"] },
  { name: "Iceland", code: "IS", timezones: ["Atlantic/Reykjavik"] },
  { name: "India", code: "IN", timezones: ["Asia/Kolkata"] },
  { name: "Indonesia", code: "ID", timezones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] },
  { name: "Iran", code: "IR", timezones: ["Asia/Tehran"] },
  { name: "Iraq", code: "IQ", timezones: ["Asia/Baghdad"] },
  { name: "Ireland", code: "IE", timezones: ["Europe/Dublin"] },
  { name: "Israel", code: "IL", timezones: ["Asia/Jerusalem"] },
  { name: "Italy", code: "IT", timezones: ["Europe/Rome"] },
  { name: "Jamaica", code: "JM", timezones: ["America/Jamaica"] },
  { name: "Japan", code: "JP", timezones: ["Asia/Tokyo"] },
  { name: "Jordan", code: "JO", timezones: ["Asia/Amman"] },
  { name: "Kazakhstan", code: "KZ", timezones: ["Asia/Almaty", "Asia/Oral"] },
  { name: "Kenya", code: "KE", timezones: ["Africa/Nairobi"] },
  { name: "Kuwait", code: "KW", timezones: ["Asia/Kuwait"] },
  { name: "Kyrgyzstan", code: "KG", timezones: ["Asia/Bishkek"] },
  { name: "Laos", code: "LA", timezones: ["Asia/Vientiane"] },
  { name: "Latvia", code: "LV", timezones: ["Europe/Riga"] },
  { name: "Lebanon", code: "LB", timezones: ["Asia/Beirut"] },
  { name: "Libya", code: "LY", timezones: ["Africa/Tripoli"] },
  { name: "Lithuania", code: "LT", timezones: ["Europe/Vilnius"] },
  { name: "Luxembourg", code: "LU", timezones: ["Europe/Luxembourg"] },
  { name: "Malaysia", code: "MY", timezones: ["Asia/Kuala_Lumpur"] },
  { name: "Maldives", code: "MV", timezones: ["Indian/Maldives"] },
  { name: "Mexico", code: "MX", timezones: ["America/Mexico_City", "America/Monterrey", "America/Tijuana"] },
  { name: "Moldova", code: "MD", timezones: ["Europe/Chisinau"] },
  { name: "Mongolia", code: "MN", timezones: ["Asia/Ulaanbaatar"] },
  { name: "Morocco", code: "MA", timezones: ["Africa/Casablanca"] },
  { name: "Myanmar", code: "MM", timezones: ["Asia/Rangoon"] },
  { name: "Nepal", code: "NP", timezones: ["Asia/Kathmandu"] },
  { name: "Netherlands", code: "NL", timezones: ["Europe/Amsterdam"] },
  { name: "New Zealand", code: "NZ", timezones: ["Pacific/Auckland"] },
  { name: "Nigeria", code: "NG", timezones: ["Africa/Lagos"] },
  { name: "North Korea", code: "KP", timezones: ["Asia/Pyongyang"] },
  { name: "Norway", code: "NO", timezones: ["Europe/Oslo"] },
  { name: "Oman", code: "OM", timezones: ["Asia/Muscat"] },
  { name: "Pakistan", code: "PK", timezones: ["Asia/Karachi"] },
  { name: "Palestine", code: "PS", timezones: ["Asia/Gaza"] },
  { name: "Panama", code: "PA", timezones: ["America/Panama"] },
  { name: "Paraguay", code: "PY", timezones: ["America/Asuncion"] },
  { name: "Peru", code: "PE", timezones: ["America/Lima"] },
  { name: "Philippines", code: "PH", timezones: ["Asia/Manila"] },
  { name: "Poland", code: "PL", timezones: ["Europe/Warsaw"] },
  { name: "Portugal", code: "PT", timezones: ["Europe/Lisbon"] },
  { name: "Qatar", code: "QA", timezones: ["Asia/Qatar"] },
  { name: "Romania", code: "RO", timezones: ["Europe/Bucharest"] },
  { name: "Russia", code: "RU", timezones: ["Europe/Moscow", "Asia/Novosibirsk", "Asia/Vladivostok", "Asia/Yekaterinburg"] },
  { name: "Saudi Arabia", code: "SA", timezones: ["Asia/Riyadh"] },
  { name: "Serbia", code: "RS", timezones: ["Europe/Belgrade"] },
  { name: "Singapore", code: "SG", timezones: ["Asia/Singapore"] },
  { name: "Slovakia", code: "SK", timezones: ["Europe/Bratislava"] },
  { name: "Slovenia", code: "SI", timezones: ["Europe/Ljubljana"] },
  { name: "South Africa", code: "ZA", timezones: ["Africa/Johannesburg"] },
  { name: "South Korea", code: "KR", timezones: ["Asia/Seoul"] },
  { name: "Spain", code: "ES", timezones: ["Europe/Madrid"] },
  { name: "Sri Lanka", code: "LK", timezones: ["Asia/Colombo"] },
  { name: "Sudan", code: "SD", timezones: ["Africa/Khartoum"] },
  { name: "Sweden", code: "SE", timezones: ["Europe/Stockholm"] },
  { name: "Switzerland", code: "CH", timezones: ["Europe/Zurich"] },
  { name: "Syria", code: "SY", timezones: ["Asia/Damascus"] },
  { name: "Taiwan", code: "TW", timezones: ["Asia/Taipei"] },
  { name: "Tajikistan", code: "TJ", timezones: ["Asia/Dushanbe"] },
  { name: "Tanzania", code: "TZ", timezones: ["Africa/Dar_es_Salaam"] },
  { name: "Thailand", code: "TH", timezones: ["Asia/Bangkok"] },
  { name: "Tunisia", code: "TN", timezones: ["Africa/Tunis"] },
  { name: "Turkey", code: "TR", timezones: ["Europe/Istanbul"] },
  { name: "Turkmenistan", code: "TM", timezones: ["Asia/Ashgabat"] },
  { name: "Uganda", code: "UG", timezones: ["Africa/Kampala"] },
  { name: "Ukraine", code: "UA", timezones: ["Europe/Kiev"] },
  { name: "United Arab Emirates", code: "AE", timezones: ["Asia/Dubai"] },
  { name: "United Kingdom", code: "GB", timezones: ["Europe/London"] },
  { name: "United States", code: "US", timezones: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"] },
  { name: "Uruguay", code: "UY", timezones: ["America/Montevideo"] },
  { name: "Uzbekistan", code: "UZ", timezones: ["Asia/Tashkent"] },
  { name: "Venezuela", code: "VE", timezones: ["America/Caracas"] },
  { name: "Vietnam", code: "VN", timezones: ["Asia/Ho_Chi_Minh"] },
  { name: "Yemen", code: "YE", timezones: ["Asia/Aden"] },
  { name: "Zimbabwe", code: "ZW", timezones: ["Africa/Harare"] },
];

// Format timezone for display: "Asia/Kolkata" -> "IST (UTC+5:30)"
export function formatTimezone(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(now);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    const shortName = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
    return `${shortName} (${tzName})`;
  } catch {
    return tz;
  }
}

// Get all unique timezones in the system
export function getAllTimezones(): string[] {
  const allTzs = new Set<string>();
  allTzs.add("UTC");
  allTzs.add("GMT");
  for (const c of COUNTRIES) {
    for (const tz of c.timezones) {
      allTzs.add(tz);
    }
  }
  return Array.from(allTzs).sort();
}

// Get timezone options for a country code
export function getTimezonesForCountry(countryCode: string): string[] {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  return country?.timezones ?? [];
}

// Detect browser's current timezone
export function detectBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
