# CypherClash - Agent Handoff Guide

**Last updated: 19 October 2026, 13:24 IST**

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

The planned target is the evening of **20 October 2026**. Core authentication,
admin controls, leaderboard, score ledger, and Circuit Sync are present.
Prioritize verifying the integrated flows, completing only game mechanics
whose rules are defined, production configuration/deployment, and operational
testing. Rounds 2 and 3 still need owner-supplied rules; do not invent them.

## 3. Current status

Implemented:

- Approved public landing page dark design and front-end routes `/`,
  `/login`, `/dashboard`, `/dashboard/circuit-sync`, `/leaderboard`,
  `/admin/login`, and `/admin`.
- Express/Mongoose backend with team/admin authentication, Mongo-backed
  sessions, team and admin APIs, and event logging.
- Team and admin login screens use the dark design system, show/hide password
  controls, generic inline errors, and one Back to home button (no login
  navbar). The team dashboard shows team identity/presence, current round
  status and countdown, total and R1-R3 score breakdown, leaderboard link,
  and three Round 1 game cards.
- Dashboard team/score polling remains on the existing API calls and runs
  every 25 seconds while visible. The countdown updates locally between polls,
  freezes while paused, and the UI shows the last successful update and an
  offline state. Circuit Sync is playable only while Round 1 is running and
  before its score is recorded. Maze and Runner remain disabled placeholders.
- The admin control room uses the existing round, team, score, and log APIs
  for round controls, team operations, score adjustments, and audit logs.
  Logs refresh every 15 seconds; the UI does not render log details or
  credentials.
- `GET /api/team/me` returns current round status, deadline, paused timestamp,
  and server remaining time. The code also uses in-memory caches where
  appropriate. Inspect the actual route/middleware code before changing
  database access or cache behavior.
- Session hardening, validation, rate limiting, audit logging, and credential
  protection described below.
- Append-only `ScoreEntry` ledger, persisted `RoundState`, round controls and
  automatic deadline expiry, team totals, and admin score adjustments. Ended
  rounds can restart as a new attempt; results are unique per team, round,
  attempt, and game, while earlier ledger entries remain in totals.
- Per-team seeded game sessions with idempotent start, bounded inputs,
  pause-aware elapsed time, and a server-side finish/validation flow before
  scoring. Use HTTP only; do not add Socket.IO or WebSockets.
- Circuit Sync is a fixed five-stage shared-screen puzzle with 3, 4, 4, 5,
  and 6 switches. It uses AND, OR, XOR, NAND, NOR, NOT, and XNOR gates,
  timestamped inputs, and deterministic server replay before scoring. Its
  top-down schematic uses distinct wires and node highlighting. The netlist
  and operation text beneath the diagram are intentionally omitted.

In progress / not started:

- Maze and Runner gameplay/validators; their validator modules currently
  return “not implemented” and their dashboard cards are disabled.
- Qualification/elimination, owner-specified rules for Rounds 2 and 3,
  production deployment, CSRF protection if cross-site cookies are required,
  and production load testing.
- The round and score foundations are not a complete event engine. Validate
  all security and scoring assumptions against the implementation before
  release.

### Handoff / sharing state

The current working branch is `ui-restyle`. The working tree contains
uncommitted modified and untracked frontend, backend, shared-game, and test
files. A clone of a remote branch alone will not include those local changes.
Before handing the project to someone cloning it, review `git status` and
commit/push the intended changes or transfer the complete working tree. Do not
discard or overwrite existing local work.

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
| POST | `/api/games/:game/start` | Authenticated team; starts or resumes its active game session |
| POST | `/api/games/:game/finish` | Authenticated team; submits a bounded input log for server validation |
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

Frontend routes are `/`, `/login`, `/dashboard`, `/dashboard/circuit-sync`,
`/leaderboard`, `/admin/login`, and `/admin`.

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

1. **Circuit Sync / Code Repair (implemented):** a fixed five-stage Boolean
   circuit puzzle using 3, 4, 4, 5, and 6 switches. The puzzles cover OR,
   AND, XOR, NAND, NOR, NOT, and XNOR gates, including a two-lamp target.
   The shared screen shows the full gate wiring and target lamps. One player
   can trace the logic while the other enters switch changes with keys `1`-`6`
   and submits with `Enter`; players may swap roles between stages. A wrong
   submission locks the submit control for three seconds; after three
   mistakes the switch positions reset. Correct stages unlock the next puzzle,
   and the server derives points by replaying the timestamped toggle/submit
   log.
2. **Dual-Control Maze:** planned; both players share one keyboard and
   cooperate through walls, checkpoints, collectibles, switches, barriers,
   and an exit.
3. **Cyber Runner:** planned as an approximately 90-120 second shared runner.
   One player uses `W` and the other uses `ArrowRight`. Score can include
   coins, distance, checkpoints, collisions, and game-over state.

There is one shared screen and keyboard per team. There is no live connection
between two browsers. Circuit Sync's former open decision is resolved: show
the full puzzle on the shared screen; do not use a paper clue or a replacement
game. For real-time-action games, the server issues a
per-team random seed and authoritative start time. The browser runs the game
and records timestamped inputs. On finish, it submits the input log, never a
score. The server deterministically replays the log, validates duration, input
rate, and impossible moves, then calls `submitGameResult` once. The server is
the authority for the replay result. Puzzle-style games may instead submit
each step to the server for validation. Circuit Sync currently records
timestamped steps locally and submits that bounded log for deterministic
server replay. Persist only the final validated result unless a game requires
otherwise.

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

The minimal scoring foundation and game-session routes are implemented.
Circuit Sync has a deterministic validator; Maze and Runner validators remain
stubs. The current implementation provides:

- `ScoreEntry` append-only records.
- A unique partial index allowing only one `game_result` per team/round/attempt/game.
- `submitGameResult(teamId, game, points, session)` as a service-only entry point for
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
- Per-team seeded game sessions with idempotent start, bounded timestamped
  inputs, pause-aware elapsed time, and an atomic finish claim before scoring.

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

- Current branch: `ui-restyle` (see the handoff/sharing note in section 3;
  changes in the working tree are not automatically included in a clone).
- No scoring or round files should be deleted or rewritten into mutable totals.
- Do not expose `submitGameResult` directly to arbitrary clients. Game
  endpoints must derive team identity from the authenticated session and
  validate input logs or puzzle steps on the server.
- Do not add Socket.IO or WebSockets. The approved design uses HTTP polling
  and one shared screen.
- Before continuing, inspect:
  [`ScoreEntry`](./server/src/models/ScoreEntry.js),
  [`RoundState`](./server/src/models/RoundState.js),
  [`roundState.js`](./server/src/services/roundState.js), and
  [`scoring.js`](./server/src/services/scoring.js).
- Relevant automated coverage is in
  [`server/test/scoring.test.js`](./server/test/scoring.test.js),
  [`server/test/games.test.js`](./server/test/games.test.js), and
  [`server/test/circuit.test.js`](./server/test/circuit.test.js). Run the
  complete server suite against a dedicated test database; see section 14.

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
- Only round/game cards should carry strong colour gradients; other
  surfaces remain white, black, or grey.
- Keep visuals simple and do not add animations unless requested.
- Do not use a global `!important` font rule.
- Clearly label placeholder leaderboard content as “Sample data”.
- Desktop is primary, but do not break phone layouts.

## 12. Open decisions

Ask the owner one question at a time instead of guessing:

1. How do Bias Points combine with round points, and how are starting amounts
   decided?
2. Team count, hosting provider, and deployment domains?
3. Rules and mechanics for Rounds 2 and 3?
4. Scoring formulas, penalties, bonuses, progression, elimination, and
   leaderboard freeze policy?
5. Credential distribution, clue/answer formats, venue, timing, and event
   date?
6. What do pause and team reset mean, and what data do they preserve?

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
`MONGO_URI`. Configure `SESSION_SECRET`, `ADMIN_USERNAME`, and
`ADMIN_PASSWORD` in the local ignored `server/.env`; never copy real values
into this README or commit the env file. The frontend can override the API
origin with `VITE_API_URL`.

Checks:

```bash
# From the repository root
npm run build
node --test src/circuitSchematicLayout.test.js

# From server/
npm test
```

Server tests require `MONGO_URI_TEST` with a database name ending in `_test`,
or `MONGO_URI` (the test bootstrap derives an `_test` database name). Use a
disposable local/test database; the test suite writes and clears test records.
The root package does not define an `npm test` script. The frontend production
build was last verified on 19 October 2026; run the checks again after any
subsequent changes.
