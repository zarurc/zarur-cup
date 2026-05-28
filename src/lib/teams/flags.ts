/**
 * Map FIFA 3-letter team codes (used in our DB) to flag emoji.
 *
 * Most codes resolve through ISO 3166-1 alpha-2 lookup → regional-indicator
 * pair. Two WC 2026 teams (England, Scotland) are not ISO countries and use
 * the GB-ENG / GB-SCT tag-sequence emojis directly.
 *
 * Coverage: all 48 teams in data/wc2026/teams.csv. If an unknown FIFA code
 * is passed we fall back to the generic black flag (🏴) — same as before
 * this map existed.
 */

export type Team = {
  id: string;
  code: string;
  name_en: string;
  name_he: string;
};

const FIFA_TO_ISO: Record<string, string> = {
  MEX: 'MX',
  RSA: 'ZA',
  KOR: 'KR',
  CZE: 'CZ',
  CAN: 'CA',
  BIH: 'BA',
  QAT: 'QA',
  SUI: 'CH',
  BRA: 'BR',
  MAR: 'MA',
  HAI: 'HT',
  USA: 'US',
  PAR: 'PY',
  AUS: 'AU',
  TUR: 'TR',
  GER: 'DE',
  CUW: 'CW',
  CIV: 'CI',
  ECU: 'EC',
  NED: 'NL',
  JPN: 'JP',
  SWE: 'SE',
  TUN: 'TN',
  BEL: 'BE',
  EGY: 'EG',
  IRN: 'IR',
  NZL: 'NZ',
  ESP: 'ES',
  CPV: 'CV',
  KSA: 'SA',
  URU: 'UY',
  FRA: 'FR',
  SEN: 'SN',
  IRQ: 'IQ',
  NOR: 'NO',
  ARG: 'AR',
  ALG: 'DZ',
  AUT: 'AT',
  JOR: 'JO',
  POR: 'PT',
  COD: 'CD',
  UZB: 'UZ',
  COL: 'CO',
  CRO: 'HR',
  GHA: 'GH',
  PAN: 'PA',
};

const SPECIAL: Record<string, string> = {
  ENG: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  SCO: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
};

function isoToFlag(iso: string): string {
  const codePoints = [...iso.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
  );
  return String.fromCodePoint(...codePoints);
}

export function fifaCodeToFlagEmoji(fifaCode: string): string {
  if (SPECIAL[fifaCode]) return SPECIAL[fifaCode];
  const iso = FIFA_TO_ISO[fifaCode];
  if (!iso) return '\u{1F3F4}';
  return isoToFlag(iso);
}
