export type Role = 'MEMBER' | 'ORGANIZER' | 'ADMIN';
export type GameNightStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type ParticipationStatus = 'RSVPED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export type RankDefinition = { policyVersion: string; ordinal: number; minAttendedGames: number; title: string; active: boolean };
export type PlayerRank = { attendedGameCount: number; currentRank: RankDefinition; nextRank?: RankDefinition; gamesUntilNextRank: number };
export type Player = { id: string; email: string; displayName: string; role: Role; rank: PlayerRank };
export type GameNight = { id: string; createdBy: string; title: string; startsAt: string; endsAt: string; venueName: string; venueAddress: string; notes: string; capacity: number; participantCount: number; status: GameNightStatus };
export type Participation = { id: string; gameNightId: string; playerId: string; status: ParticipationStatus; joinedAt: string };
export type LeaderboardEntry = { playerId: string; displayName: string; rank: PlayerRank };
export type Leaderboard = { entries: LeaderboardEntry[]; viewerPosition: number };
