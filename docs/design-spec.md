# Troy BotC frontend design spec

## Confirmed decisions

- Expo React Native with a web-first responsive experience.
- Firebase email-link authentication supplies the bearer token required by the API.
- Explicit demo mode is available for UI development; API failures are not silently mocked.
- Rank is based only on organizer-confirmed attendance.
- Backend permissions remain authoritative for organizer and admin actions.

## API contract

The app targets `/v1/me`, `/v1/game-nights`, `/v1/game-nights/{id}`, `/v1/game-nights/{id}/registrations`, `/v1/game-nights/{id}/roster`, `/v1/game-nights/{id}/attendance`, `/v1/users/search`, `/v1/leaderboard`, `/v1/admin/rank-policy`, and `/v1/players/{playerId}/role`.

Admins and organizers create sessions and manually register active users selected from the protected global user set. Members have read-only session and roster views; they do not RSVP or remove themselves. Registration is not attendance.

Roster entries include the participant's current `displayName` alongside the existing participation fields. The participants list displays that name; `playerId` remains the stable key for removal and attendance operations. Deploy the additive API field before rolling out the client.

Successful registration and removal refresh both the selected session's roster and the game-session list. Session details synchronize with the refreshed session so the participant count and remaining capacity update without leaving the screen.

Already registered users are labelled and cannot be selected again. Removed
users can be registered again while the session is draft or published. Failed
registration or removal displays the API error and refreshes the roster and
capacity; failed registration retains the selection for retry. Members and
closed sessions do not expose registration editing controls.
