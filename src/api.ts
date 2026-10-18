import type { AttendanceDecision, AttendanceStatus, GameNight, GameNightCreate, Leaderboard, Player, Participation, RosterEntry, UserSearchResult } from './types';
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
  { id: 'night-1', createdBy: 'player-1', title: 'Friday Fables', startsAt: '2026-10-09T18:30:00Z', endsAt: '2026-10-09T23:00:00Z', venueName: 'The Storyteller', venueAddress: 'Kadıköy, Istanbul', notes: 'New players welcome. Bring your favourite script.', capacity: 15, participantCount: 11, status: 'PUBLISHED' },
  { id: 'night-2', createdBy: 'player-1', title: 'The Trouble Brewing Table', startsAt: '2026-10-17T16:00:00Z', endsAt: '2026-10-17T21:00:00Z', venueName: 'Troy Games Club', venueAddress: 'Beşiktaş, Istanbul', notes: 'Experienced players preferred.', capacity: 12, participantCount: 12, status: 'PUBLISHED' },
  { id: 'night-3', createdBy: 'player-1', title: 'Autumn Social', startsAt: '2026-10-24T17:00:00Z', endsAt: '2026-10-24T21:00:00Z', venueName: 'Troy Games Club', venueAddress: 'Beşiktaş, Istanbul', notes: '', capacity: 15, participantCount: 4, status: 'DRAFT' },
];
const demoPlayer: Player = { id: 'player-1', email: 'you@example.com', displayName: 'Hüseyin', role: 'ORGANIZER', rank: { attendedGameCount: 7, currentRank: ranks(7), nextRank: { ...ranks(10), minAttendedGames: 10, ordinal: 3, title: 'Librarian' }, gamesUntilNextRank: 3 } };

const demoUsers: UserSearchResult[] = [{ id: 'player-2', displayName: 'Merve' }, { id: 'player-3', displayName: 'Can' }];
const demoRegistrations = new Map(demoNights.map((night) => [night.id, new Set([demoPlayer.id])]));
const demoAttendance = new Map<string, Map<string, AttendanceStatus>>();
function updateDemoAttendanceCount(delta: number) {
  const attendedGameCount = demoPlayer.rank.attendedGameCount + delta;
  demoPlayer.rank = {
    attendedGameCount,
    currentRank: ranks(attendedGameCount),
    nextRank: attendedGameCount < 10 ? { ...ranks(10), minAttendedGames: 10, ordinal: 3, title: 'Librarian' } : undefined,
    gamesUntilNextRank: Math.max(0, 10 - attendedGameCount),
  };
}
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
  if (path.match(/^\/v1\/game-nights\/[^/]+$/) && options.method !== 'PATCH') {
    const id = path.split('/').pop()!;
    const night = demoNights.find((night) => night.id === id);
    if (!night) throw new ApiError(404, 'Game night not found');
    return { ...night } as T;
  }
  if (path === '/v1/game-nights' && options.method === 'POST') {
    const input = JSON.parse(String(options.body)) as GameNightCreate;
    const night: GameNight = { ...input, id: `night-${demoNights.length + 1}`, createdBy: demoPlayer.id, participantCount: 0, status: 'DRAFT' };
    demoNights.push(night);
    demoRegistrations.set(night.id, new Set());
    return { ...night } as T;
  }
  if (options.method === 'POST' && path.match(/^\/v1\/game-nights\/[^/]+\/publish$/)) {
    const id = path.split('/')[3];
    const night = demoNights.find((item) => item.id === id);
    if (!night) throw new ApiError(404, 'Game night not found');
    if (demoPlayer.role !== 'ADMIN' && night.createdBy !== demoPlayer.id) throw new ApiError(403, 'Only the game-night organizer can publish this game night');
    if (night.status !== 'DRAFT') throw new ApiError(409, 'Only draft game nights can be published');
    night.status = 'PUBLISHED';
    return { ...night } as T;
  }
  if (path === '/v1/game-nights') return demoNights.map((n) => ({ ...n })) as T;
  if (path.match(/^\/v1\/game-nights\/[^/]+\/roster$/)) return Array.from(demoRegistrations.get(path.split('/')[3]) ?? []).map((playerId, index): RosterEntry => {
    const user = [demoPlayer, ...demoUsers].find((item) => item.id === playerId);
    if (!user) throw new ApiError(400, 'Player is not an active community user');
    return { id: `demo-registration-${index}`, gameNightId: path.split('/')[3], playerId, displayName: user.displayName, status: demoAttendance.get(path.split('/')[3])?.get(playerId) ?? 'REGISTERED', joinedAt: new Date().toISOString() };
  }) as T;
  if (options.method === 'POST' && path.match(/^\/v1\/game-nights\/[^/]+\/attendance$/)) {
    const id = path.split('/')[3];
    const night = demoNights.find((item) => item.id === id);
    const registrations = demoRegistrations.get(id);
    if (!night || !registrations) throw new ApiError(404, 'Game night not found');
    if (night.status !== 'PUBLISHED' && night.status !== 'COMPLETED') throw new ApiError(409, 'Attendance can only be recorded for a published game night');
    if (demoPlayer.role !== 'ADMIN' && night.createdBy !== demoPlayer.id) throw new ApiError(403, 'Only the game-night organizer can record attendance');
    const decisions = JSON.parse(String(options.body)) as AttendanceDecision[];
    const requested = new Map<string, AttendanceStatus>();
    decisions.forEach(({ playerId, status }) => {
      if (!playerId || (status !== 'ATTENDED' && status !== 'NO_SHOW')) throw new ApiError(400, 'Each attendance decision needs a player and status');
      if (requested.has(playerId)) throw new ApiError(400, 'Each player may appear only once');
      requested.set(playerId, status);
    });
    if (requested.size !== registrations.size || [...registrations].some((playerId) => !requested.has(playerId))) {
      throw new ApiError(400, 'Attendance must include every registered participant exactly once');
    }
    const previous = demoAttendance.get(id) ?? new Map<string, AttendanceStatus>();
    if (night.status === 'COMPLETED' && demoPlayer.role !== 'ADMIN'
      && [...requested].some(([playerId, status]) => previous.get(playerId) !== status)) {
      throw new ApiError(403, 'Only an admin can correct finalized attendance');
    }
    requested.forEach((status, playerId) => {
      const oldStatus = previous.get(playerId);
      if (playerId === demoPlayer.id) {
        updateDemoAttendanceCount(Number(status === 'ATTENDED') - Number(oldStatus === 'ATTENDED'));
      }
      previous.set(playerId, status);
    });
    demoAttendance.set(id, previous);
    if (night.status === 'PUBLISHED') night.status = 'COMPLETED';
    return undefined as T;
  }
  if (path.startsWith('/v1/users/search')) return demoUsers as T;
  if (path === '/v1/leaderboard') return { viewerPosition: 4, entries: [{ playerId: 'p1', displayName: 'Merve', rank: { attendedGameCount: 14, currentRank: ranks(14), gamesUntilNextRank: 0 } }, { playerId: 'p2', displayName: 'Can', rank: { attendedGameCount: 10, currentRank: ranks(10), gamesUntilNextRank: 0 } }, { playerId: 'p3', displayName: 'Deniz', rank: { attendedGameCount: 8, currentRank: ranks(8), gamesUntilNextRank: 2 } }, { playerId: demoPlayer.id, displayName: demoPlayer.displayName, rank: demoPlayer.rank }] } as T;
  if (options.method === 'PATCH' && path.match(/^\/v1\/game-nights\/[^/]+$/)) {
    const id = path.split('/').pop()!;
    const night = demoNights.find((item) => item.id === id)!;
    Object.assign(night, JSON.parse(String(options.body)));
    return night as T;
  }
  if (options.method === 'DELETE' && path.match(/^\/v1\/game-nights\/[^/]+\/registrations\/[^/]+$/)) {
    const id = path.split('/')[3];
    const night = demoNights.find((item) => item.id === id);
    if (!night) throw new ApiError(404, 'Game night not found');
    const playerId = path.split('/').pop()!;
    if (demoRegistrations.get(id)?.delete(playerId)) {
      night.participantCount--;
      demoAttendance.get(id)?.delete(playerId);
    }
    return undefined as T;
  }
  if (options.method === 'POST' && path.endsWith('/registrations')) {
    const body = JSON.parse(String(options.body)) as { playerIds: string[] };
    const id = path.split('/')[3];
    const night = demoNights.find((item) => item.id === id);
    const registrations = demoRegistrations.get(id);
    if (!night || !registrations) throw new ApiError(404, 'Game night not found');
    body.playerIds.forEach((playerId) => {
      if (!registrations.has(playerId)) { registrations.add(playerId); night.participantCount++; }
    });
  }
  return {} as T;
}
export const api = { me: (token?: string) => request<Player>('/v1/me', {}, token), nights: (token?: string) => request<GameNight[]>('/v1/game-nights', {}, token), createNight: (input: GameNightCreate, token?: string) => request<GameNight>('/v1/game-nights', { method: 'POST', body: JSON.stringify(input) }, token), night: (id: string, token?: string) => request<GameNight>(`/v1/game-nights/${id}`, {}, token), updateNight: (id: string, update: Partial<Omit<GameNight, 'id' | 'createdBy' | 'participantCount' | 'status'>>, token?: string) => request<GameNight>(`/v1/game-nights/${id}`, { method: 'PATCH', body: JSON.stringify(update) }, token), publishNight: (id: string, token?: string) => request<GameNight>(`/v1/game-nights/${id}/publish`, { method: 'POST' }, token), roster: (id: string, token?: string) => request<RosterEntry[]>(`/v1/game-nights/${id}/roster`, {}, token), recordAttendance: (id: string, decisions: AttendanceDecision[], token?: string) => request<void>(`/v1/game-nights/${id}/attendance`, { method: 'POST', body: JSON.stringify(decisions) }, token), leaderboard: (token?: string) => request<Leaderboard>('/v1/leaderboard', {}, token), searchUsers: (query = '', token?: string) => request<UserSearchResult[]>(`/v1/users/search?q=${encodeURIComponent(query)}`, {}, token), register: (id: string, playerIds: string[], token?: string) => request<Participation[]>(`/v1/game-nights/${id}/registrations`, { method: 'POST', body: JSON.stringify({ playerIds }) }, token), removeRegistration: (id: string, playerId: string, token?: string) => request<void>(`/v1/game-nights/${id}/registrations/${playerId}`, { method: 'DELETE' }, token) };
