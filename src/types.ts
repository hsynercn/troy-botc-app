export type Role = 'MEMBER' | 'ORGANIZER' | 'ADMIN';
export type GameNightStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type ParticipationStatus = 'REGISTERED' | 'RSVPED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export type RankDefinition = { policyVersion: string; ordinal: number; minAttendedGames: number; title: string; active: boolean };
export type PlayerRank = { attendedGameCount: number; currentRank: RankDefinition; nextRank?: RankDefinition; gamesUntilNextRank: number };
export type Player = { id: string; email: string; displayName: string; role: Role; rank: PlayerRank };
export type GameNight = { id: string; createdBy: string; title: string; startsAt: string; endsAt: string | null; venueName: string; venueAddress: string | null; notes: string | null; capacity: number; participantCount: number; status: GameNightStatus };
export type GameNightCreate = Pick<GameNight, 'title' | 'startsAt' | 'endsAt' | 'venueName' | 'venueAddress' | 'notes' | 'capacity'>;
export type Participation = { id: string; gameNightId: string; playerId: string; status: ParticipationStatus; joinedAt: string; attendanceRecordedAt?: string };
export type AttendanceStatus = Extract<ParticipationStatus, 'ATTENDED' | 'NO_SHOW'>;
export type AttendanceDecision = { playerId: string; status: AttendanceStatus };
export type RosterEntry = Participation & { displayName: string };
export type UserSearchResult = { id: string; displayName: string };
export type LeaderboardEntry = { playerId: string; displayName: string; rank: PlayerRank };
export type Leaderboard = { entries: LeaderboardEntry[]; viewerPosition: number };
