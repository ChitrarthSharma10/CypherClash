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

- Each team has one login: a Team ID and password. There are no P1/P2 slots or
  per-player accounts, and each team may have only one active session.
- Each team plays on one shared screen and keyboard. Both players must
  participate in person; game controls should require cooperative input where
  practical (for example, one player uses `W` and the other `ArrowRight` in
  Runner).
- Participants are cybersecurity students and may attack the platform through
  DevTools or forged requests. Security is a first-class requirement.
- The event is supervised, so software controls to prove which player pressed
  each key are not required.
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
- Team/admin login, Mongo-backed sessions, team dashboard API, admin team
  API, and event logging.
- Frontend routes `/login`, `/dashboard`, `/admin/login`, and `/admin`.
- The team dashboard shows team identity, team online status, server-provided
  round state and deadline, a locally ticking countdown, and the team's own
  ledger totals. Dashboard, timer, presence, and leaderboard refresh by HTTP
  every 25 seconds while the browser tab is visible.
- The admin control room uses the existing round, team, score, and log APIs for
  round controls, team operations, score adjustments, and recent audit logs.
  Logs refresh every 15 seconds and the UI does not render log details or
  credentials.
- No API endpoints were added for the dashboard/admin UI. `GET /api/team/me`
  now includes current round status, deadline, paused timestamp, and server
  remaining time; the client computes its display countdown from the deadline
  and paused timestamp.
- Team presence, round state, team totals, and leaderboard snapshots are held
  in memory. Poll responses reuse these caches; only auth middleware verifies
  the active team against MongoDB on protected team requests.
- Session hardening, validation, rate limiting, audit logging, and credential
  protection described below.
- Minimal scoring foundation:
  append-only `ScoreEntry` ledger, persisted `RoundState`, in-memory round
  cache with startup reload, automatic deadline expiry, global
  start/pause/resume/end controls, team score totals, and admin adjustments.
- An ended round can be restarted as a new attempt. Earlier ledger entries are
  retained and continue to count toward the round total; game results are
  unique per team, round, attempt, and game.
- The scoring foundation has been smoke-tested for duplicate result rejection,
  deadline rejection, pause/resume deadline extension, and team-session denial from
  admin routes.
- Automated scoring tests now cover paused submissions, simultaneous duplicate
  submissions, simultaneous resume calls, admin adjustments whose reason is
  `game_result`, paused-round reload, and team-score isolation. Run them with
  `cd server && npm test` using valid local environment values.
- Socket.IO and WebSocket support have been removed. `circuitSync.js` remains
  unregistered legacy game code and must not be wired back into the app.
- The complete backend test suite runs sequentially with `cd server && npm
  test`; update or replace legacy two-seat tests as the single-screen game
  implementation is built.

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
- Transport: ordinary HTTP requests and polling only. Do not add Socket.IO or
  WebSockets. Dashboard, round timer, presence, and leaderboard poll every
  25 seconds while visible and use in-memory server caches.
- Database: MongoDB Atlas free tier. It has limited storage and throughput;
  use a small connection pool and avoid unnecessary per-request operations.
- Hosting is not yet decided. Production needs HTTPS and a host that will not
  sleep during the event.

Important backend files:

`server/src/app.js`, `config.js`, `sessionStore.js`, middleware, routes,
models, utilities, and `seed.js`.

Environment variable names are documented in
[`server/.env.example`](./server/.env.example). Values belong only in the
ignored `server/.env` file.

## 5. Existing API

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/login` | Team |
| POST | `/api/auth/admin/login` | Admin |
| POST | `/api/auth/logout` | Any session |
| GET | `/api/auth/me` | Any session |
| GET | `/api/team/me` | Authenticated team |
| GET | `/api/team/score` | Authenticated team; own totals and round breakdown |
| POST | `/api/team/heartbeat` | Authenticated team |
| POST | `/api/admin/teams` | Admin; creates a team and its login credentials |
| GET | `/api/admin/teams` | Admin |
| PATCH | `/api/admin/teams/:teamId` | Admin |
| POST | `/api/admin/teams/:teamId/reset-password` | Admin; resets the team's shared password |
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

Team login uses a `CC-###`-style Team ID and one shared team password. Admin
login uses username and password. Sessions are httpOnly cookies stored in
MongoDB, with at most one active session per team. Do not expose seat slots or
per-player accounts in the product or API. Team password hashes are stored on `Team` and excluded from normal queries.
Current models include `Team`, `Admin`, `EventLog`, `ScoreEntry`, and
`RoundState`; the `Player` model has been removed. `circuitSync.js` remains
unregistered legacy game code.

Frontend routes are `/`, `/login`, `/dashboard`, `/admin/login`, and `/admin`.

## 6. Product requirements

The team dashboard should eventually show team identity and online status,
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
team-level permissions, one-active-session-per-team enforcement, round
locking, final-answer confirmation, admin override, activity monitoring,
responsive layout, and stable performance are required. The browser must
never be the authority for score, identity, time, answers, or validated game
state. For browser-run games, the server issues a seed and start time and
derives the validated outcome by deterministic replay of the submitted input
log.

## 7. Round 1 direction

Round 1 is planned as three mini-games under one overall time limit. Both
players must participate, and scoring should reflect performance rather than
simply first-to-finish.

1. **Dual-Control Maze:** both players share one keyboard and cooperate through
   walls, checkpoints, collectibles, switches, barriers, and an exit.
2. **Cyber Runner:** an approximately 90-120 second shared runner. One player
   uses `W` and the other uses `ArrowRight`. Score can include coins,
   distance, checkpoints, collisions, and game-over state.
3. **Circuit Sync / Code Repair:** its one-screen design is an OPEN DECISION:
   use a paper clue, replace it with another game, or show everything on the
   shared screen. Wrong connections may penalise or reset; correct
   configurations unlock stages.

There is one shared screen and keyboard per team. There is no live connection
between two browsers. For real-time-action games, the server issues a
per-team random seed and authoritative start time. The browser runs the game
and records timestamped inputs. On finish, it submits the input log, never a
score. The server deterministically replays the log, validates duration, input
rate, and impossible moves, then calls `submitGameResult` once. The server is
the authority for the replay result. Puzzle-style games may instead submit
each step to the server for validation. Persist only the final validated
result unless a game requires otherwise.

If time is short, prefer an asymmetric-information puzzle engine over the
runner. Do not guess the rules for later rounds.

## 8. Security and hardening

Always:

- The browser talks only to the API, never directly to MongoDB.
- Identity, role, team, score, time, and answer authority comes from the
  server-side session and server state. A team's identity comes from its
  authenticated Team ID, never from a client-submitted identity.
- Never send answers or private team data to the wrong player/team.
- Validate request bodies strictly with Zod, reject unknown fields, cap
  lengths, and validate URL parameters.
- Never log secrets, plaintext passwords, password hashes, or connection
  strings.
- Store credentials only as bcrypt hashes. Generated passwords use
  `crypto.randomInt`, are 12 characters, and are shown once.
- Regenerate the session ID after successful team/admin login and save the
  session.
- Reload the team on every protected team request. Missing or inactive teams
  must lose access immediately.
- Use the exported Mongo session store with an httpOnly cookie, configurable
  secure/SameSite settings, 12-hour expiry, and `touchAfter`.
- Keep API response shapes stable.
- Use `Cache-Control: no-store` on auth/admin responses and one-time
  credential responses.
- Audit admin actions with the admin actor ID and old/new values where
  applicable.
- Keep team/admin rate limiters separate, count failed attempts only, and
  key shared-IP-sensitive limiters so one client cannot lock out others.
- Use the configured `TRUST_PROXY` value; do not hardcode proxy trust.

Current code has these hardening requirements implemented: session
regeneration and saving, startup validation for placeholder/short secrets,
username/password limits, recursive event-log truncation, configurable
`TRUST_PROXY` and `BCRYPT_COST`, secure password generation, all-or-nothing
team creation, admin audit events, Bias Points bounds, `req.team` reuse in
`GET /api/team/me`, team-ID validation, no-store middleware, and
IP+username/IP+team-ID limiter keys. Team disable and password reset revoke
the team's sessions.

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
- A unique partial index allowing only one `game_result` per team/round/attempt/game.
- `submitGameResult(teamId, game, points)` as a service-only entry point for
  validated server results. It requires a running, unexpired round, clamps
  points to `0..1000`, and returns a clear duplicate-submission error. Never
  accept the score from the browser: replay and validate a timestamped input
  log against the server-issued per-team seed and start time, or validate each
  puzzle step on the server, before calling it once.
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
- Do not expose `submitGameResult` directly to arbitrary clients. Game
  endpoints must derive team identity from the authenticated session and
  validate input logs or puzzle steps on the server.
- Do not add Socket.IO or WebSockets. The socket transport and hub have been
  removed; `circuitSync.js` remains unregistered. The approved design uses
  cached HTTP polling and one shared screen.
- Before continuing, inspect:
  [`ScoreEntry`](./server/src/models/ScoreEntry.js),
  [`RoundState`](./server/src/models/RoundState.js),
  [`roundState.js`](./server/src/services/roundState.js), and
  [`scoring.js`](./server/src/services/scoring.js).
- The implementation was smoke-tested with a temporary MongoDB-backed round:
  the first result succeeded, a duplicate failed with `Game result already
  submitted`, a post-deadline result failed with `Round is not running`, pause
  and resume moved the deadline by the pause duration, and a team session calling
  `/api/admin/rounds` received `403 Admin access required`.
- The focused automated suite is
  [`server/test/scoring.test.js`](./server/test/scoring.test.js); it covers
  rejection while paused or after deadline, duplicate submissions, one active
  round, round-attempt restart, pause/resume, ledger indexing, and team score
  isolation.

## 10. Performance

Atlas M0 has limited throughput and no automated backups. Plan around
approximately 65 concurrent users:

- Avoid per-poll database reads or writes.
- Keep presence and leaderboard snapshots in server memory where appropriate.
- Poll the dashboard, round timer, team presence, and leaderboard every 25
  seconds while the tab is visible; show the latest successful update time and
  an offline message after failures.
- Keep a small Mongoose connection pool.
- Ask participants to log in before round start.
- Export teams, scores, and logs before and during the event.
- Run a load test with roughly 65 simulated players, simultaneous login, round
  start, and submissions before the event.

Polling is paused while a tab is hidden. Countdown displays continue locally
from the latest server deadline and re-synchronize on each poll. Polling is not
a measured production capacity guarantee.

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

1. Circuit Sync on one shared screen: paper clue, replacement game, or show
   everything?
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
> Read this README first. Each team has one login and plays on one shared
> screen. Use HTTP polling and in-memory caches only; do not add Socket.IO or
> WebSockets. The server owns identity, time, scores, answers, and validation:
> replay timestamped game inputs from a server-issued seed/start time or
> validate puzzle steps before scoring. Validate strict input, never log
> secrets, work in small steps, preserve the landing page, use append-only
> score records, avoid unnecessary Atlas operations, and list every changed
> file.

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
