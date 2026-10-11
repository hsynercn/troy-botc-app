# Troy BotC frontend design spec

## Confirmed decisions

- Expo React Native with a web-first responsive experience.
- Firebase email-link authentication supplies the bearer token required by the API.
- Explicit demo mode is available for UI development; API failures are not silently mocked.
- Rank is based only on organizer-confirmed attendance.
- Backend permissions remain authoritative for organizer and admin actions.
- The authenticated shell fills the viewport, with content in a bounded
  ScrollView and navigation outside it so long pages remain scrollable on
  desktop and mobile browsers. Login retains its separate layout.

## API contract

The app targets `/v1/me`, `/v1/game-nights`, `/v1/game-nights/{id}`, `/v1/game-nights/{id}/publish`, `/v1/game-nights/{id}/registrations`, `/v1/game-nights/{id}/roster`, `/v1/game-nights/{id}/attendance`, `/v1/users/search`, `/v1/leaderboard`, `/v1/admin/rank-policy`, and `/v1/players/{playerId}/role`.

Admins and organizers create sessions and manually register active users selected from the protected global user set. Members have read-only session and roster views; they do not RSVP or remove themselves. Registration is not attendance.

Attendance is finalized from game-night details by an admin or the game-night's owner organiser while the night is `PUBLISHED`, without a scheduled-time gate. The organizer must explicitly mark every non-cancelled roster entry `ATTENDED` or `NO_SHOW`; cancelled entries are excluded and no status is preselected. One submission to `POST /v1/game-nights/{id}/attendance` records the decisions and completes the night, including when the eligible roster is empty. This is one user/API submission, not an all-or-nothing database transaction: if a request fails after some decisions persist, the app refreshes the roster and preserves the choices for retry. Only `ATTENDED` contributes to a user's attended-game count. On a `COMPLETED` night, only admins may correct attendance from the details screen; the night remains completed and the count reflects the corrected status. The API is authoritative for ownership and role checks.

The Game nights screen exposes **Create session** to organizers and admins,
including when the list is empty. The form submits `POST /v1/game-nights`
with the Firebase bearer token and opens the created session's details while
refreshing the shared session list. Sessions start as private `DRAFT`s, visible
only to their creator and admins; creation does not publish them. End time,
address, and notes are optional. Dates must include a timezone, capacity is an
integer from 1 to 500, and validation/API failures retain the form for retry.
Start time defaults to the time the form opens, and end time to four hours
later, both expressed as UTC ISO timestamps. The defaults remain editable;
the optional end time can be cleared before creation.
This uses the existing API contract; no backend rollout or migration is needed.

The owner organiser or an admin can publish a draft from its details screen.
The app calls `POST /v1/game-nights/{id}/publish` with the Firebase bearer
token, then refreshes the game-night list and updates the open details to
`PUBLISHED`. Publishing reveals the attendance controls; drafts cannot be
completed directly. The API remains authoritative for ownership, role, and
draft-state validation.

Roster entries include the participant's current `displayName` alongside the existing participation fields. The participants list displays that name; `playerId` remains the stable key for removal and attendance operations. Deploy the additive API field before rolling out the client.

Successful registration and removal refresh both the selected session's roster and the game-session list. Session details synchronize with the refreshed session so the participant count and remaining capacity update without leaving the screen.

Already registered users are labelled and cannot be selected again. Removed
users can be registered again while the session is draft or published. Failed
registration or removal displays the API error and refreshes the roster and
capacity; failed registration retains the selection for retry. Members and
closed sessions do not expose registration editing controls.
