/**
 * FIFA 3-letter team code -> Unicode flag emoji.
 *
 * Unicode flag emojis are pairs of Regional Indicator Symbols (U+1F1E6..U+1F1FF)
 * formed from ISO 3166-1 alpha-2 country codes. Most FIFA codes are alpha-3
 * derivatives of the same country; we map them to alpha-2 and synthesize the
 * pair. ENG/SCO have no alpha-2 (they're UK subdivisions) — they use the
 * "subdivision flag" tag sequences introduced in Unicode 11 (iOS 12.1+,
 * Android, Windows 10+).
 *
 * Unknown codes fall back to the literal black flag emoji rather than throwing,
 * so the row still renders if the seed gains a team we forgot to map.
 */

const FIFA_TO_ISO2: Record<string, string> = {
  ALG: 'DZ', ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BIH: 'BA',
  BRA: 'BR', CAN: 'CA', CIV: 'CI', COD: 'CD', COL: 'CO', CPV: 'CV',
  CRO: 'HR', CUW: 'CW', CZE: 'CZ', ECU: 'EC', EGY: 'EG', ESP: 'ES',
  FRA: 'FR', GER: 'DE', GHA: 'GH', HAI: 'HT', IRN: 'IR', IRQ: 'IQ',
  JOR: 'JO', JPN: 'JP', KOR: 'KR', KSA: 'SA', MAR: 'MA', MEX: 'MX',
  NED: 'NL', NOR: 'NO', NZL: 'NZ', PAN: 'PA', PAR: 'PY', POR: 'PT',
  QAT: 'QA', RSA: 'ZA', SEN: 'SN', SUI: 'CH', SWE: 'SE', TUN: 'TN',
  TUR: 'TR', URU: 'UY', USA: 'US', UZB: 'UZ',
};

const SUBDIVISION_FLAGS: Record<string, string> = {
  ENG: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  SCO: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
};

const BLACK_FLAG = '\u{1F3F4}';

export function codeToFlag(code: string): string {
  const sub = SUBDIVISION_FLAGS[code];
  if (sub) return sub;
  const iso2 = FIFA_TO_ISO2[code];
  if (!iso2) return BLACK_FLAG;
  const A = 'A'.charCodeAt(0);
  return iso2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + (c.charCodeAt(0) - A)))
    .join('');
}
