# Troy BotC frontend design spec

## Confirmed decisions

- Expo React Native with a web-first responsive experience.
- Firebase email-link authentication supplies the bearer token required by the API.
- Explicit demo mode is available for UI development; API failures are not silently mocked.
- Rank is based only on organizer-confirmed attendance.
- Backend permissions remain authoritative for organizer and admin actions.

## API contract

The app targets `/v1/me`, `/v1/game-nights`, `/v1/game-nights/{id}`, `/v1/game-nights/{id}/participation`, `/v1/game-nights/{id}/roster`, `/v1/game-nights/{id}/attendance`, `/v1/leaderboard`, `/v1/admin/rank-policy`, and `/v1/players/{playerId}/role`.
