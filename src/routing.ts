// Only canonical product paths can be used as an authentication return destination.
// No query, fragment, encoded separators, scheme, or login/root redirect loops.
export function safeDestination(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  if (['/home', '/game-nights', '/leaderboard', '/profile'].includes(value)) return value;
  return /^\/game-nights\/[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

export function loginDestination(destination: unknown, reauthenticate = false) {
  const safe = safeDestination(destination);
  return safe ? { pathname: '/login' as const, params: { returnTo: safe, ...(reauthenticate ? { reauthenticate: 'true' } : {}) } } : '/login' as const;
}

export const sectionPaths: Record<string, string> = {
  home: '/home', nights: '/game-nights', leaderboard: '/leaderboard', profile: '/profile',
};

export function errorKind(error: Error | null) {
  const status = error && 'status' in error ? Number(error.status) : 0;
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'missing';
  return 'retry';
}
