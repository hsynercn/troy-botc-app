import type { GameNight, Leaderboard, Player, Participation } from './types';
import { getIdToken } from './firebase';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://x7u8a70xx0.execute-api.us-east-1.amazonaws.com/dev';
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const ranks = (count: number) => ({ policyVersion: 'pilot-1', ordinal: count >= 10 ? 3 : count >= 5 ? 2 : 1, minAttendedGames: count >= 10 ? 10 : count >= 5 ? 5 : 0, title: count >= 10 ? 'Librarian' : count >= 5 ? 'Chronicler' : 'Traveller', active: true });
const demoNights: GameNight[] = [
  { id: 'night-1', createdBy: 'demo', title: 'Friday Fables', startsAt: '2026-10-09T18:30:00Z', endsAt: '2026-10-09T23:00:00Z', venueName: 'The Storyteller', venueAddress: 'Kadıköy, Istanbul', notes: 'New players welcome. Bring your favourite script.', capacity: 15, participantCount: 11, status: 'PUBLISHED' },
  { id: 'night-2', createdBy: 'demo', title: 'The Trouble Brewing Table', startsAt: '2026-10-17T16:00:00Z', endsAt: '2026-10-17T21:00:00Z', venueName: 'Troy Games Club', venueAddress: 'Beşiktaş, Istanbul', notes: 'Experienced players preferred.', capacity: 12, participantCount: 12, status: 'PUBLISHED' },
  { id: 'night-3', createdBy: 'demo', title: 'Autumn Social', startsAt: '2026-10-24T17:00:00Z', endsAt: '2026-10-24T21:00:00Z', venueName: 'Troy Games Club', venueAddress: 'Beşiktaş, Istanbul', notes: '', capacity: 15, participantCount: 4, status: 'DRAFT' },
];
const demoPlayer: Player = { id: 'player-1', email: 'you@example.com', displayName: 'Hüseyin', role: 'ORGANIZER', rank: { attendedGameCount: 7, currentRank: ranks(7), nextRank: { ...ranks(10), minAttendedGames: 10, ordinal: 3, title: 'Librarian' }, gamesUntilNextRank: 3 } };

let demoRsvps = new Set(['night-1']);
export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  if (DEMO_MODE) return demoRequest<T>(path, options);
  const bearer = token ?? await getIdToken();
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...options.headers } });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch { /* Preserve the HTTP fallback message. */ }
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
async function demoRequest<T>(path: string, options: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  if (path === '/v1/me') return demoPlayer as T;
  if (path === '/v1/game-nights') return demoNights.map((n) => ({ ...n, participantCount: n.participantCount + (demoRsvps.has(n.id) && n.id !== 'night-1' ? 1 : 0) })) as T;
  if (path.startsWith('/v1/game-nights/') && path.endsWith('/participation')) { const id = path.split('/')[3]; if (options.method === 'DELETE') demoRsvps.delete(id); else demoRsvps.add(id); return { gameNightId: id, playerId: demoPlayer.id, status: demoRsvps.has(id) ? 'RSVPED' : 'CANCELLED' } as T; }
  if (path === '/v1/leaderboard') return { viewerPosition: 4, entries: [{ playerId: 'p1', displayName: 'Merve', rank: { attendedGameCount: 14, currentRank: ranks(14), gamesUntilNextRank: 0 } }, { playerId: 'p2', displayName: 'Can', rank: { attendedGameCount: 10, currentRank: ranks(10), gamesUntilNextRank: 0 } }, { playerId: 'p3', displayName: 'Deniz', rank: { attendedGameCount: 8, currentRank: ranks(8), gamesUntilNextRank: 2 } }, { playerId: demoPlayer.id, displayName: demoPlayer.displayName, rank: demoPlayer.rank }] } as T;
  return {} as T;
}
export const api = { me: (token?: string) => request<Player>('/v1/me', {}, token), nights: (token?: string) => request<GameNight[]>('/v1/game-nights', {}, token), leaderboard: (token?: string) => request<Leaderboard>('/v1/leaderboard', {}, token), join: (id: string, token?: string) => request<Participation>(`/v1/game-nights/${id}/participation`, { method: 'POST' }, token), leave: (id: string, token?: string) => request<void>(`/v1/game-nights/${id}/participation`, { method: 'DELETE' }, token) };
