# CypherClash - Agent Handoff Guide

**Last updated: 18 October 2026, 17:04 IST**

Read this file before changing the project. It is the durable project brief
for developers and AI coding agents.

Never put secrets, passwords, connection strings, session secrets, or API keys
in this file, in chats, prompts, or git.

## 1. Product and event

CypherClash is a student cybersecurity tournament run by the club OsCode. The
whole event should run through one website: team login, games, clues,
submissions, scoring, leaderboard, round progression, and admin controls.
Organisers should not need to manage small event operations by hand.

- Each team has two players: `P1` and `P2`.
- Both players must actively participate. No game may be solvable by one
  person alone.
- Participants are cybersecurity students and may attack the platform through
  DevTools or forged requests. Security is a first-class requirement.
- The event is supervised, so software controls against one person playing both
  roles are not required.
- Plan for a maximum of approximately 65 people online simultaneously.

## 2. Deadline and priorities

The target for a complete working version is the evening of **20 October
2026**. The event date and available buffer are not confirmed, so prioritise
working core flows over visual polish.

1. Core website, login, and team system (implemented and being hardened)
2. Round 1 games
3. Round 2 and Round 3 mechanics, once specified
4. Scoring, leaderboard, and admin controls
5. Testing, polish, and animations

Pull a minimal admin flow (create teams, credentials, start/stop round) and
minimal server-side scoring forward because rounds cannot be tested without
them. Suggested schedule: core/auth and first deployment on 18 October, Round
1 and server-side scoring on 19 October, then leaderboard, admin controls,
security, load testing, and fixes on 20 October. Animations are optional.

## 3. Current status

Implemented:

- Approved public landing page dark design.
- Express/Mongoose backend under `/server`.
- Player/admin login, Mongo-backed sessions, player dashboard API, admin team
  API, and event logging.
- Frontend routes `/login`, `/dashboard`, `/admin/login`, and `/admin`.
- The player dashboard shows team identity, seat presence, server-provided
  round state and deadline, a locally ticking countdown, and the player's
  own ledger totals. It refreshes the player APIs every 20 seconds.
- The admin control room uses the existing round, team, score, and log APIs for
  round controls, team operations, score adjustments, and recent audit logs.
  Logs refresh every 15 seconds and the UI does not render log details or
  credentials.
- No API endpoints were added for the dashboard/admin UI. `GET /api/team/me`
  now includes current round status, deadline, paused timestamp, and server
  remaining time; the client computes its display countdown from the deadline
  and paused timestamp.
- Player presence is held in memory for recent dashboard requests and active
  sockets. The admin teams endpoint reads online state from that presence data
  rather than querying player records per request. Presence expires after 45
  seconds without an active socket or player request.
- Session hardening, validation, rate limiting, audit logging, and credential
  protection described below.
- Minimal scoring foundation on branch `feature-core-platform`:
  append-only `ScoreEntry` ledger, persisted `RoundState`, in-memory round
  cache with startup reload, automatic deadline expiry, global
  start/pause/resume/end controls, team score totals, and admin adjustments.
- The scoring foundation has been smoke-tested for duplicate result rejection,
  deadline rejection, pause/resume deadline extension, and player denial from
  admin routes.
- Automated scoring tests now cover paused submissions, simultaneous duplicate
  submissions, simultaneous resume calls, admin adjustments whose reason is
  `game_result`, paused-round reload, and team-score isolation. Run them with
  `cd server && npm test` using valid local environment values.
- On branch `feature-realtime`, Socket.IO shares the Express session and
  session store, validates player/team state and Origin, limits each seat to
  one active connection, and registers Circuit Sync as the first realtime
  game module. Team sockets are disconnected when an admin disables a team or
  resets a player password.
- Circuit Sync tests verify seat-private views, refresh recovery, team
  presence, pause behavior, full three-stage completion, and score visibility.
  The complete backend test suite runs sequentially with `cd server && npm
  test`.

In progress / not started:

- Other games and game-result HTTP routes.
- Leaderboard API/UI, qualification or elimination logic, Rounds 2 and 3,
  deployment, and production load testing.
- The current round state and score routes are foundation-level only; do not
  treat them as a complete game or event engine.

Do not assume a hardening requirement is complete without checking the actual
code. Verify each item when working in the relevant area.

## 4. Technology and repository

- Frontend: React, Vite, npm, lightweight pathname/history routing.
- Backend: Node.js, Express, Mongoose, `express-session`, `connect-mongo`,
  `bcryptjs`, `helmet`, `express-rate-limit`, `zod`, `cors`, and `dotenv`.
- Realtime transport: Socket.IO in `/server`, sharing the Express session
  middleware.
- Database: MongoDB Atlas free tier. It has limited storage and throughput;
  use a small connection pool and avoid unnecessary per-request operations.
- Hosting is not yet decided. Production needs HTTPS, WebSocket support if
  live games use it, and a host that will not sleep during the event.

Important backend files:

`server/src/app.js`, `config.js`, `sessionStore.js`, middleware, routes,
models, utilities, and `seed.js`.

Environment variable names are documented in
[`server/.env.example`](./server/.env.example). Values belong only in the
ignored `server/.env` file.

## 5. Existing API

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Player |
| POST | `/api/auth/admin/login` | Admin |
| POST | `/api/auth/logout` | Any session |
| GET | `/api/auth/me` | Any session |
| GET | `/api/team/me` | Current player/team |
| GET | `/api/team/score` | Current player; own totals and round breakdown |
| POST | `/api/team/heartbeat` | Current player |
| POST | `/api/admin/teams` | Admin; creates team and both players |
| GET | `/api/admin/teams` | Admin |
| PATCH | `/api/admin/teams/:teamId` | Admin |
| POST | `/api/admin/teams/:teamId/reset-password` | Admin |
| POST | `/api/admin/teams/:teamId/clear-login-lockout` | Admin |
| POST | `/api/admin/rounds/:n/start` | Admin |
| POST | `/api/admin/rounds/:n/pause` | Admin |
| POST | `/api/admin/rounds/:n/resume` | Admin |
| POST | `/api/admin/rounds/:n/end` | Admin |
| GET | `/api/admin/rounds` | Admin |
| POST | `/api/admin/teams/:teamId/adjust` | Admin; append score adjustment |
| GET | `/api/admin/scores` | Admin; current totals |
| GET | `/api/admin/logs` | Admin |
| GET | `/api/health` | Public |

Player login uses a `CC-###`-style team ID, `P1`/`P2` slot, and password.
Admin login uses username and password. Sessions are httpOnly cookies stored in
MongoDB. The current models are `Team`, `Player`, `Admin`, `EventLog`,
`ScoreEntry`, and `RoundState`.

Frontend routes are `/`, `/login`, `/dashboard`, `/admin/login`, and `/admin`.

## 6. Product requirements

The team dashboard should eventually show team identity, both player statuses,
current round, score, round breakdown, initial Bias Points, time remaining,
progress, rank, leaderboard access, instructions, and submissions where
needed.

The public leaderboard should eventually show rank, team, Bias Points, each
round, and total. It must never reveal another team's clues, answers,
credentials, or private internals. The relationship between Bias Points and
competition total is still undecided.

The admin control room should support team management, credentials, Bias
Points, team status, round start/pause/resume/end, timers, scores, bonuses and
penalties, submitted answers, qualification/elimination, clues and answers,
team/game reset, monitoring, completion status, and technical intervention.

Timers, auto-save, server-side score validation, session persistence,
player-specific permissions, round locking, final-answer confirmation,
admin override, activity monitoring, responsive layout, and stable
performance are required. The browser must never be the authority for score,
identity, time, answers, or game state.

## 7. Round 1 direction

Round 1 is planned as three mini-games under one overall time limit. Both
players must participate, and scoring should reflect performance rather than
simply first-to-finish.

1. **Dual-Control Maze:** P1 controls horizontal movement and P2 controls
   vertical movement through walls, checkpoints, collectibles, switches,
   barriers, and an exit. A teammate is building this game.
2. **Cyber Runner:** an approximately 90-120 second shared runner. P1 moves
   left with `W`; P2 moves right with `ArrowRight`. Score can include coins,
   distance, checkpoints, collisions, and game-over state.
3. **Circuit Sync / Code Repair:** one player sees a target and gives hints;
   the other operates switches, wires, or nodes. Wrong connections penalise or
   reset; correct configurations unlock stages.

The device arrangement (one computer or two devices per team) is undecided.
Two devices may require a live server connection. Agree with the Maze
implementer on a common module contract: start, receive state, send inputs, and
finish. The server decides positions, collisions, deadlines, and points; the
browser renders and sends inputs. Store only final results durably unless a
game requires otherwise.

If time is short, prefer an asymmetric-information puzzle engine over the
runner. Do not guess the rules for later rounds.

## 8. Security and hardening

Always:

- The browser talks only to the API, never directly to MongoDB.
- Identity, role, team, score, time, and answer authority comes from the
  server-side session and server state.
- Never send answers or private team data to the wrong player/team.
- Validate request bodies strictly with Zod, reject unknown fields, cap
  lengths, and validate URL parameters.
- Never log secrets, plaintext passwords, password hashes, or connection
  strings.
- Store credentials only as bcrypt hashes. Generated passwords use
  `crypto.randomInt`, are 12 characters, and are shown once.
- Regenerate the session ID after successful player/admin login and save the
  session.
- Reload the player and team on every protected player request. Missing
  players and inactive teams must lose access immediately.
- Use the exported Mongo session store with an httpOnly cookie, configurable
  secure/SameSite settings, 12-hour expiry, and `touchAfter`.
- Keep API response shapes stable.
- Use `Cache-Control: no-store` on auth/admin responses and one-time
  credential responses.
- Audit admin actions with the admin actor ID and old/new values where
  applicable.
- Keep player/admin rate limiters separate, count failed attempts only, and
  key shared-IP-sensitive limiters so one client cannot lock out others.
- Use the configured `TRUST_PROXY` value; do not hardcode proxy trust.

Current code has these hardening requirements implemented: session
regeneration and saving, startup validation for placeholder/short secrets,
username/password limits, recursive event-log truncation, configurable
`TRUST_PROXY` and `BCRYPT_COST`, secure password generation, all-or-nothing
team creation, admin audit events, Bias Points bounds, `req.team` reuse in
`GET /api/team/me`, team-ID validation, no-store middleware, and
IP+username/IP+team+slot limiter keys.

Still verify before production:

- The seeded admin username is uncommon and any old admin record is removed.
- If frontend/API domains differ and cookies use `SameSite=None`, add CSRF
  protection for state-changing requests.
- Disable a team and reset a password while a player is logged in; the next
  player request must fail.

## 9. Scoring rule and current foundation

The minimal scoring foundation is now implemented, but game rules and game
routes are not. Do not build game scoring until the round specifications are
available. The current implementation provides:

- `ScoreEntry` append-only records.
- A unique partial index allowing only one `game_result` per team/game.
- `submitGameResult(teamId, game, points)` as a service-only entry point for
  future server-controlled games. It requires a running, unexpired round,
  clamps points to `0..1000`, and returns a clear duplicate-submission error.
- `getTotals(teamId)` and cached `getAllTotals()`.
- `RoundState` start, global pause, resume with deadline extension, end, and
  timer-based automatic expiry.
- Admin score adjustments limited to `-1000..1000` with reasons capped at 200
  characters.

When extending scoring, every point change must remain an append-only,
auditable record
containing:

- Team
- Round
- Amount
- Reason
- Actor
- Timestamp

Calculate totals from the ledger instead of storing only a mutable total.
This makes admin bonuses and penalties auditable and reversible. Bias Points
may remain a simple initial team field.

### Scoring checkpoint for the next agent

- Branch: `feature-core-platform`.
- No scoring or round files should be deleted or rewritten into mutable totals.
- Do not expose `submitGameResult` directly to arbitrary clients. Future game
  routes must derive team identity from the authenticated session and validate
  game state on the server.
- Do not add another realtime transport or a leaderboard until the game/device
  decision and round specifications are confirmed. Socket.IO and the first
  Circuit Sync module now exist on `feature-realtime`.
- Before continuing, inspect:
  [`ScoreEntry`](./server/src/models/ScoreEntry.js),
  [`RoundState`](./server/src/models/RoundState.js),
  [`roundState.js`](./server/src/services/roundState.js), and
  [`scoring.js`](./server/src/services/scoring.js).
- The implementation was smoke-tested with a temporary MongoDB-backed round:
  the first result succeeded, a duplicate failed with `Game result already
  submitted`, a post-deadline result failed with `Round is not running`, pause
  and resume moved the deadline by the pause duration, and a player calling
  `/api/admin/rounds` received `403 Admin access required`.
- The focused automated suite is
  [`server/test/scoring.test.js`](./server/test/scoring.test.js). It passed all
  six tests on 18 October 2026. The round-restart case is exercised by
  reloading a persisted paused state through `initializeRoundStates()`.

## 10. Performance

Atlas M0 has limited throughput and no automated backups. Plan around
approximately 65 concurrent users:

- Avoid per-request database writes.
- Keep presence and leaderboard snapshots in server memory where appropriate.
- Poll no more often than every 20-30 seconds unless measurement justifies it.
- Keep a small Mongoose connection pool.
- Ask participants to log in before round start.
- Export teams, scores, and logs before and during the event.
- Run a load test with roughly 65 simulated players, simultaneous login, round
  start, and submissions before the event.

The current frontend heartbeat/dashboard polling is a starting point, not a
measured production capacity guarantee.

## 11. Design system

Preserve the approved landing page content, layout, hierarchy, and styles.
New screens should use namespaced `cc-` classes and the existing dark system:

- Near-black base `#0a0a0d`, surfaces `#121217`, light text, muted text, and
  subtle borders.
- Clash Display for headlines, Inter for body text, and JetBrains Mono for
  uppercase technical labels.
- White pill buttons and minimal chrome.
- Only the four round cards should carry strong colour gradients; other
  surfaces remain white, black, or grey.
- Keep visuals simple and do not add animations unless requested.
- Do not use a global `!important` font rule.
- Clearly label placeholder leaderboard content as “Sample data”.
- Desktop is primary, but do not break phone layouts.

## 12. Open decisions

Ask the owner one question at a time instead of guessing:

1. One computer or two devices per team?
2. How do Bias Points combine with round points, and how are starting amounts
   decided?
3. Team count, hosting provider, and deployment domains?
4. Rules and mechanics for Rounds 2 and 3?
5. Scoring formulas, penalties, bonuses, progression, elimination, and
   leaderboard freeze policy?
6. Credential distribution, clue/answer formats, venue, timing, and event
   date?
7. What do pause and team reset mean, and what data do they preserve?

## 13. Working rules for agents

1. Read this file and inspect the real code before editing.
2. Work one small step at a time and commit before risky changes.
3. Make precise, surgical changes; do not refactor or reformat unrelated code.
4. Do not touch the landing page unless explicitly asked.
5. Preserve API shapes and existing conventions.
6. Reuse existing helpers, validation, authorization, and logging patterns.
7. Surface errors explicitly; never silently swallow failures.
8. Never ask for, store, output, or commit secrets.
9. Use `server/.env.example` with placeholders only.
10. Run the smallest relevant build, syntax check, or test after changes.
11. List every file created or changed at the end of each task.
12. Ask before making a significant design decision or installing a dependency.
13. Spend extra review effort on security, scoring, game server logic, and
    debugging; use routine scaffolding only when it is safe.

For custom agent instruction files, the short version is:

> CypherClash is an Express/MongoDB event platform with a Vite frontend.
> Read this README first. Security is first: the server owns identity, timers,
> scores, answers, and game state. Validate strict input, never trust client
> values, never log secrets, work in small steps, preserve the landing page,
> use append-only score records, avoid unnecessary Atlas operations, and list
> every changed file.

## 14. Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
cp .env.example .env
npm run seed
npm run dev
```

The frontend defaults to `http://localhost:5173` and the API to
`http://localhost:4000`. MongoDB must be running or configured through
`MONGO_URI`.
