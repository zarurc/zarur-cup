import 'server-only';

/**
 * football-data.org v4 client — fetches WC 2026 fixtures + scores (D-46).
 *
 * Free-tier auth: single `X-Auth-Token: <key>` header. Rate limit 10 req/min
 * on the authenticated free tier; our cron polls every 15 min so we are
 * comfortably under budget.
 *
 * Endpoint: GET /competitions/{code}/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 * Response: { matches: ExternalMatch[] }
 *
 * The `competitionCode` defaults to 'WC' (historical FIFA World Cup code on
 * football-data.org). The Wave-0 validation step in /api/score-fetch's
 * pre-deploy smoke test confirms this against `/v4/competitions/?plan=TIER_ONE`
 * — if vendor changes the code, override via the `competitionCode` param.
 *
 * Stored-XSS defense (T-12-01): team-name fields are sanitized against a
 * regex matching letters, digits, spaces, hyphens, periods, and commas. Any
 * row failing the regex is dropped from the result with a console.warn —
 * React's auto-escape on render is the second defense.
 */

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const DEFAULT_COMPETITION_CODE = 'WC';

// Same FREE_TEXT_REGEX shape as Plan 02-04 prop_answer validation
// (letters from any script, digits, spaces, hyphens, periods, commas).
const SAFE_NAME_REGEX = /^[\p{L}\d \-.,'()]{1,80}$/u;

export type ExternalMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELED';

export type ExternalMatch = {
  utcDate: string;
  status: ExternalMatchStatus;
  homeTeam: { id: number; name: string; tla: string };
  awayTeam: { id: number; name: string; tla: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

export async function fetchWcMatches(opts: {
  sinceDays?: number;
  competitionCode?: string;
} = {}): Promise<ExternalMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN env var is missing');

  const code = opts.competitionCode ?? DEFAULT_COMPETITION_CODE;
  const sinceMs = (opts.sinceDays ?? 1) * 86_400_000;
  const dateFrom = new Date(Date.now() - sinceMs).toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const url = `${FOOTBALL_DATA_BASE}/competitions/${code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { matches?: unknown[] };
  const raw = Array.isArray(json.matches) ? json.matches : [];

  const sanitized: ExternalMatch[] = [];
  for (const m of raw) {
    if (typeof m !== 'object' || m === null) continue;
    const obj = m as Record<string, unknown>;

    const homeTeam = obj.homeTeam as
      | { id?: number; name?: string; tla?: string }
      | undefined;
    const awayTeam = obj.awayTeam as
      | { id?: number; name?: string; tla?: string }
      | undefined;

    if (
      !homeTeam ||
      !awayTeam ||
      typeof homeTeam.tla !== 'string' ||
      typeof awayTeam.tla !== 'string' ||
      typeof homeTeam.name !== 'string' ||
      typeof awayTeam.name !== 'string'
    ) {
      continue;
    }

    // Stored-XSS defense: reject row if team name fails the safe-name regex.
    if (!SAFE_NAME_REGEX.test(homeTeam.name) || !SAFE_NAME_REGEX.test(awayTeam.name)) {
      // eslint-disable-next-line no-console
      console.warn('score-fetch: rejected match with unsafe team name', {
        home: homeTeam.name,
        away: awayTeam.name,
      });
      continue;
    }

    const score = obj.score as
      | { fullTime?: { home?: number | null; away?: number | null } }
      | undefined;
    const ft = score?.fullTime;

    sanitized.push({
      utcDate: typeof obj.utcDate === 'string' ? obj.utcDate : '',
      status: (typeof obj.status === 'string' ? obj.status : 'SCHEDULED') as ExternalMatchStatus,
      homeTeam: {
        id: typeof homeTeam.id === 'number' ? homeTeam.id : -1,
        name: homeTeam.name,
        tla: homeTeam.tla,
      },
      awayTeam: {
        id: typeof awayTeam.id === 'number' ? awayTeam.id : -1,
        name: awayTeam.name,
        tla: awayTeam.tla,
      },
      score: {
        fullTime: {
          home: typeof ft?.home === 'number' ? ft.home : null,
          away: typeof ft?.away === 'number' ? ft.away : null,
        },
      },
    });
  }

  return sanitized;
}
