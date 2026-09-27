/** Ligas de fútbol que merecen H2H, forma y pronóstico. El resto se guarda igual. */
export const FOOTBALL_PRIORITY_LEAGUES = new Set([
  1, 2, 3, 4, 9, 11, 13, 39, 61, 71, 78, 88, 94, 128, 135, 140, 144, 203,
  239, 253, 262, 307, 848,
]);

export const PROVIDERS = {
  football: {
    sport: 'football',
    baseUrl: 'https://v3.football.api-sports.io',
    datePath: '/fixtures',
    h2hPath: '/fixtures/headtohead',
    teamPath: '/fixtures',
    hasDraw: true,
    overLabel: 'over 2.5',
  },
  basketball: {
    sport: 'basketball',
    baseUrl: 'https://v1.basketball.api-sports.io',
    datePath: '/games',
    h2hPath: '/games',
    teamPath: '/games',
    hasDraw: false,
    overLabel: 'total puntos',
  },
  hockey: {
    sport: 'hockey',
    baseUrl: 'https://v1.hockey.api-sports.io',
    datePath: '/games',
    h2hPath: '/games',
    teamPath: '/games',
    hasDraw: false,
    overLabel: 'total goles',
  },
  nba: {
    sport: 'nba',
    baseUrl: 'https://v2.nba.api-sports.io',
    datePath: '/games',
    h2hPath: '/games',
    teamPath: '/games',
    hasDraw: false,
    overLabel: 'total puntos',
  },
};

export const FINISHED = new Set([
  'FT',
  'AET',
  'PEN',
  'AOT',
  'AP',
  'AWD',
  'WO',
  'CANC',
  'ABD',
  'PST',
  'POST',
  'CANCL',
]);

const BASKET_RE =
  /euroleague|eurocup|\bacb\b|nba|ncaa|lega basket|basketbol|bsl|\bnbb\b|lnb|vtb/i;
const HOCKEY_RE = /\bnhl\b|\bkhl\b|\bshl\b/i;

export function isPriorityFixture(provider, leagueId, leagueName) {
  if (provider === 'nba') return String(leagueId || leagueName) === 'standard';
  if (provider === 'football') {
    const id = Number(leagueId);
    if (FOOTBALL_PRIORITY_LEAGUES.has(id)) return true;
  }
  const name = String(leagueName || '');
  if (provider === 'basketball') return BASKET_RE.test(name);
  if (provider === 'hockey') return HOCKEY_RE.test(name);
  if (provider === 'football') {
    return /champions league|europa league|conference league|premier league|la liga|serie a|bundesliga|ligue 1|libertadores|sudamericana|betplay|brasileir|liga mx|\bmls\b|eredivisie|primeira liga/i.test(
      name
    );
  }
  return false;
}
