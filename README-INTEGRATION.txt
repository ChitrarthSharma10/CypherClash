# CypherClash Round 3 integration handover

This document is the technical handover for the approved Round 3 submission scope in this checkout. It is intended to complement the authoritative server documentation in `server/README.md` and to explain how the current Round 3 implementation is wired into the repository.

## 1. Project overview and current status

The Round 3 feature is an investigation workflow for the current active round, implemented as a server-side aggregate stored in MongoDB instead of a separate investigation collection. The key design decision is that each Round 3 investigation case is embedded inside the single `RoundState` document for round 3, and every mutation is admitted by a single atomic update against that document.

Current implementation status:
- Round 3 admission, mutations, closure, expiry, and final snapshot creation are backed by the same `RoundState` document.
- The round deadline is enforced using MongoDB database time (`$$NOW`) inside the admission predicate, not only in the request middleware.
- Final results are stored in the embedded `finalResult` field for each case and are preserved immutably after closure or expiry.
- The investigation routes use team and session binding to enforce role assignment and stale-assignment rejection.
- Round 3 currently exists as a standalone prototype under `round3_investigation/`. It does not log a team in: the Lead Detective must first use the existing CypherClash team login in the same browser profile. The prototype and login page must use a compatible hostname for the session cookie to be sent.
- The root production build does not integrate the prototype into the main app or copy it into `dist/`. The repository retains `scripts/copy-round3-prototype.js`, but the root build does not invoke it.

Previously verified results (not rerun as part of this rewrite):
- Investigation tests: 17/17 passed
- Lifecycle/scoring tests: 39/39 passed
- Backend suite: 75/75 passed
- Frontend Vite build: previously succeeded; the root build does not publish or copy the standalone prototype.

## 2. Repository map and exact paths

This is the exact Round 3-related repository layout relevant to the handoff:

- `package.json` - root Vite app and build pipeline
- `scripts/copy-round3-prototype.js` - standalone copy utility; it is not invoked by the root build
- `src/main.jsx` - main app entry; it does not link to the Round 3 prototype
- `src/styles.css` - main app styling; it does not style a Round 3 dashboard entry
- `round3_investigation/app.js` - standalone Round 3 prototype client logic
- `round3_investigation/index.html` - prototype entry HTML
- `round3_investigation/integrated.js` - prototype integration script for the server-backed case flow
- `round3_investigation/style.css` - prototype styling
- `server/.env.example` - runtime configuration template
- `server/README.md` - authoritative server lifecycle and contract doc
- `server/src/app.js` - Express app mounting the API routes
- `server/src/config.js` - env validation and runtime default config
- `server/src/models/RoundState.js` - active `RoundState` schema, including embedded investigation cases
- `server/src/models/InvestigationCase.js` - investigation case schema used for embed and legacy migration
- `server/src/middleware/investigationAuth.js` - participant/session validation and role binding
- `server/src/routes/admin.js` - admin routes including final-result readback
- `server/src/routes/investigation.js` - investigation gameplay and role-assignment endpoints
- `server/src/services/roundState.js` - atomic admissions, finalization, recovery, migration, and round lifecycle logic
- `server/test/investigation.test.js` - Round 3 race-condition and lifecycle regression tests
- `README-INTEGRATION.txt` - this handover document

## 3. Architecture and end-to-end request flow

### Server entry points
The Express app in `server/src/app.js` mounts the public API under these prefixes:
- `/api/auth`
- `/api/team`
- `/api/admin`
- `/api/leaderboard`
- `/api/games`
- `/api/investigation`

The Round 3 investigation feature is mounted via `app.use('/api/investigation', noStore, investigationRoutes);`.

### Round 3 storage model
The design stores Round 3 state as a single `RoundState` document for round number `3`. That document includes:
- `round`
- `attemptNo`
- `status` (`not_started`, `running`, `paused`, `ended`)
- `startedAt`, `deadline`, `durationSec`, `pausedAt`, `endedAt`
- `revision`
- `investigations` (embedded investigation cases)

Each investigation entry includes role claims, invite data, clue ledger, decryption result, accusation data, activity log, and `finalResult` once the round closes.

### End-to-end flow
1. An admin starts Round 3 via the round-state service.
2. A team member signs in through the existing CypherClash team login at `http://localhost:5177/`.
3. In the same browser profile, the team member opens `http://localhost:5177/round3_investigation/index.html` and chooses Lead Detective.
4. The page sends `POST /api/investigation/join` with the existing team session. The server verifies the round is running and the deadline is still in the future using the document predicate.
5. The server creates or claims the case in the same `RoundState` document, storing the detective session hash and invite hash, and returns the one-use analyst invitation.
6. The detective shares that invitation privately with the analyst on a separate browser profile or device.
7. The analyst enters the actual invitation returned by the detective join. `POST /api/investigation/join/analyst` creates a distinct analyst session and binds it to the same case without invalidating the detective's session.
8. Evidence, decryption, accusation, and approval operations are atomic updates to the same embedded investigation record.
9. When the round deadline passes or admin closure occurs, the same update path writes the final snapshot and locks subsequent mutation attempts.

### Authentication handoff for local testing
The standalone Round 3 page has no team login form and does not create or restore a team session. The supported team authentication flow is the existing main-app login:

1. Open `http://localhost:5177/` in the browser profile that will use the Lead Detective role.
2. Sign in with the team ID and password issued to that team. The main app posts to `POST http://localhost:4000/api/auth/login` with `credentials: "include"`.
3. After the dashboard opens, use the same browser profile to open `http://localhost:5177/round3_investigation/index.html` and join as Lead Detective.
4. Keep the detective browser session open. Share the invitation shown by the prototype privately; do not put it in a URL, source control, or public channel.
5. On the analyst's separate browser profile or device, open the same prototype URL, choose Forensic Analyst, and submit the invitation received from the successful detective join.

The team login route regenerates and saves an HTTP-only `connect.sid` session containing `role: "team"` and `teamId`. `requireTeam` checks that role and team ID and then verifies that the team is active. The session cookie has no explicit `domain` or `path` override: it is host-only for the API host and uses the default `/` path. Its `SameSite` and `Secure` values come from `COOKIE_SAMESITE` and `COOKIE_SECURE` (the local example uses `lax` and `false`). There is no CSRF-token prerequisite in the current login or investigation routes.

The main app and `integrated.js` both default their API host to `http://localhost:4000`; the standalone API helper sends `credentials: "include"` on its state polling and all role/gameplay requests. For local testing, use `localhost` consistently for the frontend page and API. The Vite server bound to `127.0.0.1` is reachable at `http://localhost:5177`, and `localhost:5177` is already the configured frontend origin in the example. Do not sign in through an API host of `localhost` and then test via a frontend/API combination that switches to `127.0.0.1`: those are different cookie hosts/sites, and CORS permission alone does not override `SameSite=Lax` cookie rules. If using another frontend hostname, align the API hostname with it and add that exact frontend origin to `FRONTEND_ORIGIN`.

An unauthenticated detective join is rejected with HTTP `401` (`Authentication required`); it is not an automatic login flow. The analyst endpoint is separately authenticated by the one-use invitation, which expires after ten minutes. Joining the analyst regenerates the analyst browser's session and stores its session hash; it does not replace the detective's session in the detective's separate browser.

## 4. Gameplay rules and evidence permissions

### Evidence rules
- `ev1` is Lead Detective-only.
- `ev2` and `ev3` can be added by either role.
- `ev4` is inserted only after successful analyst decryption of the HELIX token.
- A case cannot collect duplicate evidence keys.
- Evidence submission is rejected if the case already has a final result or if the round has closed.

### Decryption rules
- Only the Forensic Analyst may perform `POST /api/investigation/decrypt`.
- The token must be exactly `HELIX` after trimming and uppercasing.
- If successful, the service sets `decrypted` to `true`, stores the timestamp, and inserts `ev4` into the clue ledger.

### Accusation and approval rules
- Either role may submit an accusation if the referenced evidence is already in the ledger.
- The accusation is stored under the embedded case record and includes the suspect, evidence key, reasoning, submitter, and initial approval list.
- Only the opposite role may approve the accusation.
- Agreement requires both roles to approve the same accusation.
- If the round closes before both approvals are present, the `finalResult` still records the pending accusation with the state captured at closure.

## 5. Role claims, session binding, deadline enforcement, finalization, recovery, and concurrency guarantees

### Role claims and session binding
The team session is expected to remain bound to the detective role on the original team device. The analyst claim creates its own session via `req.session.regenerate()` and then stores the analyst session hash in the embedded investigation record.

The middleware in `server/src/middleware/investigationAuth.js` does the following:
- loads the team and verifies it is active
- loads the current Round 3 state
- compares the current session hash against the stored detective or analyst hash for the team
- rejects stale or mismatched assignments with `403` when the session is no longer matched to the active investigation assignment

### Deadline enforcement
The authoritative check is not only in middleware. The mutation functions in `server/src/services/roundState.js` use a filter equivalent to:
- `round: 3`
- `attemptNo`
- `status: "running"`
- `$expr: { $gt: ["$deadline", "$$NOW"] }`

This means an operation is admitted only if the MongoDB server time still considers the deadline in the future. Requests that reach the database after expiry or after closure are rejected by the same atomic write guard.

### Finalization and immutability
When the round closes or expires, `finalizeRound3State()` updates the same embedded `RoundState` document and writes a `finalResult` object for the current attempt. That final result includes:
- evidence ledger and collector metadata
- decryption success/failure and timestamp
- accusation details, submitter, approval flags, and agreement flag
- final round-end timestamp

After finalization, the final snapshot is treated as immutable. Later writes that do not match the same active attempt and live document state are rejected.

### Recovery and migration
The service includes startup recovery for cases that were ended without a final snapshot or where a legacy investigation document exists outside the aggregate. The workflow performs the following:
- loads current `RoundState` entries
- migrates legacy `InvestigationCase` documents into the aggregate when needed
- finalizes ended attempts if the snapshot is missing
- preserves the last closure state and prevents overwrites after finalization

### Concurrency guarantees
The design serializes Round 3 writes on a single document and uses a revision counter on the aggregate to make each mutation order explicit. It is designed to avoid a race where a request checks a stale in-memory deadline and then writes later after the real deadline has passed. The document write itself is the ordering point; the HTTP response may still arrive after the deadline, but the database admission decision is the source of truth.

## 6. Actual Round 3 API surfaces and request/response details

All investigation routes require a valid team session or an analyst-issued session, depending on the route. The routes are implemented in `server/src/routes/investigation.js`.

### `POST /api/investigation/join`
- Auth: team login required
- Body: `{}`
- Behavior: verifies the round is running and not expired, then claims the detective role for the current Round 3 attempt
- Success result: `201` with JSON including:
  - `state`
  - `analystInvite`
  - `inviteExpiresAt`
- Failure: `409` if the round is not running or the detective station is already claimed

### `POST /api/investigation/join/analyst`
- Auth: no team session required, but the analyst must provide a valid single-use invite
- Body: `{ "invite": "<one-time invitation from join response>" }`
- Behavior: hashes the invite, validates it against the stored invite hash, confirms the team is active, regenerates the analyst session, and binds that session to the same embedded case
- Success result: `201` with the analyst `state`
- Failure: `401` for invalid or expired invite; `409` if the analyst slot is already claimed

### `GET /api/investigation/state`
- Auth: requires an active investigation participant
- Response: JSON with:
  - `state`
  - `roundStatus`
  - `serverNow`
  - `deadline`

### `POST /api/investigation/evidence`
- Auth: investigation participant required
- Body: `{ "key": "ev1" | "ev2" | "ev3" }`
- Role restrictions: `ev1` requires the Lead Detective; `ev2` and `ev3` can be added by either role
- Success: `201` with updated `state`
- Failure: `403` for role mismatch, `409` if the evidence already exists or the case is closed, `400` for invalid key usage such as `ev4`

### `POST /api/investigation/decrypt`
- Auth: investigation participant required
- Body: `{ "token": "HELIX" }`
- Role restrictions: only the analyst may decrypt
- Success: `200` with updated `state`
- Failure: `403` when the caller is not the analyst, `400` if the token is rejected, `409` if the case is locked or already decrypted

### `POST /api/investigation/accusation`
- Auth: investigation participant required
- Body: `{ "suspect": "Mara Chen", "evidenceKey": "ev1", "reasoning": "... at least 20 characters ..." }`
- Behavior: stores the accusation for the team and marks the submitter as approving the accusation
- Success: `201` with updated `state`
- Failure: `409` when evidence is missing or the case is locked

### `POST /api/investigation/accusation/approve`
- Auth: investigation participant required
- Body: `{}`
- Behavior: adds the calling role to the accusation approval list if the accusation exists and the caller is not the submitter
- Success: `200` with updated `state`
- Failure: `409` when no valid approval is pending

### Admin final-result route
- Route: `GET /api/admin/investigation/final-results`
- Auth: admin session required via the admin middleware
- Behavior: loads the current round 3 state, filters to embedded cases with `finalResult`, sorts by `roundEndedAt`, and returns a flat final-result payload per team
- Output shape: each entry contains the team ID, round number, attempt number, and the final `finalResult` object

## 7. Environment variables and safe configuration

The runtime config is defined in `server/src/config.js` and expects the following environment variables:

- `MONGO_URI` - MongoDB connection string for the application database
- `SESSION_SECRET` - must be at least 32 characters and not contain the word `replace`
- `FRONTEND_ORIGIN` - comma-separated list of allowed exact frontend origin URLs, for example `http://localhost:5173,http://localhost:5177`; the origin must exactly match the browser URL, including hostname and port
- `ADMIN_USERNAME` - admin username for the admin login route
- `ADMIN_PASSWORD` - admin password, at least 12 characters and not containing `replace`
- `PORT` - server port, defaults to `4000`
- `COOKIE_SECURE` - when set to `true`, cookie transport is restricted to HTTPS
- `COOKIE_SAMESITE` - must be `lax`, `strict`, or `none`
- `TRUST_PROXY` - integer, non-negative
- `BCRYPT_COST` - integer, minimum `10`
- `SEED_SAMPLE_TEAMS` - optional boolean to seed sample team accounts

Example `.env` configuration:

```env
MONGO_URI=mongodb://127.0.0.1:27017/cypherclash
SESSION_SECRET=replace-with-a-unique-secret-at-least-32-chars
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5177
PORT=4000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
TRUST_PROXY=0
BCRYPT_COST=10
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-unique-password
SEED_SAMPLE_TEAMS=false
```

Do not commit `.env` files or passwords to version control. Use a local environment file and rotate secrets per deployment.

## 8. Installation, MongoDB, local development, and startup

### Local setup
From the root workspace:
- install the root app dependencies with `npm install`
- install the server dependencies in `server/` with `npm install`

### MongoDB setup
- MongoDB must be running locally or remotely before the app launches.
- The app expects a working `MONGO_URI` connection string.
- The test bootstrap enforces an isolated test database name ending in `_test` when `MONGO_URI_TEST` is not supplied.

### Local development workflow
At the server directory:

```bash
cd server
npm run dev
```

Or start directly:

```bash
cd server
npm start
```

The API exposes `GET /api/health`, which returns `{ "ok": true }`.

### Frontend production build
At the repository root:

```bash
npm run build
```

The root `npm run build` command runs Vite only. It does not invoke `scripts/copy-round3-prototype.js`, and it does not copy or integrate the standalone Round 3 prototype into the main app's `dist/` output. The copy utility remains available in the repository and can be run separately from the repository root when a standalone copy is needed.

## 9. Round 3 tests and validation commands

### Test database requirement
The test bootstrap in `server/test/bootstrap.js` ensures a dedicated test database is used. The repository expects either:
- `MONGO_URI_TEST` with a database name ending in `_test`, or
- `MONGO_URI` and the bootstrap will rewrite the database name to end with `_test` when needed

Example isolated test DB setup:

```bash
export MONGO_URI_TEST=mongodb://127.0.0.1:27017/cypherclash_round3_test
```

### Investigation-specific test
```bash
cd server
MONGO_URI_TEST=mongodb://127.0.0.1:27017/cypherclash_round3_test \
SESSION_SECRET=... \
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5177 \
ADMIN_USERNAME=admin \
ADMIN_PASSWORD=... \
node --test test/investigation.test.js
```

### Lifecycle/scoring subset
```bash
cd server
MONGO_URI_TEST=mongodb://127.0.0.1:27017/cypherclash_round3_test \
SESSION_SECRET=... \
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5177 \
ADMIN_USERNAME=admin \
ADMIN_PASSWORD=... \
node --test --test-concurrency=1 test/scoring.test.js test/games.test.js
```

### Full backend suite
```bash
cd server
MONGO_URI_TEST=mongodb://127.0.0.1:27017/cypherclash_round3_test \
SESSION_SECRET=... \
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5177 \
ADMIN_USERNAME=admin \
ADMIN_PASSWORD=... \
node --test --test-concurrency=1 test/*.test.js
```

### Frontend build
```bash
cd .
npm run build
```

### Diff hygiene
```bash
git diff --check
```

## 10. Frontend prototype and build-copy workflow

The root Vite app and Round 3 prototype are separate. The standalone prototype is in `round3_investigation/`; the root app has no dashboard link to it, and the root production build does not copy it into `dist/`. The repository retains `scripts/copy-round3-prototype.js` as a separate utility, but it is not called by the root build.

This matters because the prototype is specifically designed to interact with these backend Round 3 APIs:
- `POST /api/investigation/join`
- `POST /api/investigation/join/analyst`
- `GET /api/investigation/state`
- `POST /api/investigation/evidence`
- `POST /api/investigation/decrypt`
- `POST /api/investigation/accusation`
- `POST /api/investigation/accusation/approve`

The prototype polls shared case state and uses the server-provided deadline value to lock the UI when the round ends or expires.

The standalone prototype can communicate with the backend when the backend is running and its origin is allowed by `FRONTEND_ORIGIN`. It defaults to `http://localhost:4000`; an alternate API base URL can be supplied with the `api` query parameter. The prototype is not represented as deployed or production-ready by this handover.

## 11. Admin-only final-result access and snapshot content

The admin route in `server/src/routes/admin.js` exposes the final persisted case results at:
- `GET /api/admin/investigation/final-results`

This route requires the authenticated admin session. It reads the current round 3 state, filters to cases with `finalResult`, and returns a flattened payload with:
- `teamId`
- `round`
- `attemptNo`
- `evidence` ledger
- `decryption` outcome and timestamp
- `accusation` fields, approval flags, submitter, and agreed status
- `roundEndedAt`

This is the authoritative record for the completed investigation and is not part of the public investigation state.

Scoring rules for Round 3 have not been defined, and the investigation finalization path does not create score entries. Any point values or award rules remain pending a future decision; scoring integration is out of scope until those rules are agreed.

## 12. Troubleshooting and recovery procedures

### If a round is already expired in the database
- do not rely on stale in-memory state
- use the persisted `RoundState` document and the same atomic finalization path
- the service will finalize or reject writes based on the persisted deadline and status

### If a team never joins the investigation
- the team has no embedded case and therefore no investigation state to mutate
- requests are rejected as `409` or `403` according to the session and round state
- a team can remain valid but never assigned to a case until the `join` route is called

### If Lead Detective join returns `Authentication required`
- the standalone page does not authenticate the team; first sign in at `http://localhost:5177/` using the existing team login
- open the standalone page in the same browser profile as that login
- use `localhost` consistently for the main app, standalone page, and the default API host (`localhost:4000`); do not mix `localhost` and `127.0.0.1` for this cookie-based flow
- confirm the team is active; the join route reports inactive or missing team authentication as `Authentication required`

### If the analyst invitation is invalid, expired, or stale
- use the exact one-use invitation returned from a successful Lead Detective join; it expires after ten minutes
- the invitation is consumed when the analyst joins, so a second use is rejected
- if it expired or was already used, the team must follow the application's current round/case lifecycle; do not reuse or invent an invitation
- `POST /api/investigation/join/analyst` returns `401` with `Invalid or expired analyst invitation`
- stale session hashes or stale `attemptNo` values are rejected with `403`

### If the round was ended without a final snapshot
- `initializeRoundStates()` calls the migration/finalization recovery logic before serving active state
- this protects the startup path from silently losing the final result

### If a legacy `InvestigationCase` collection exists
- the migration logic looks for legacy cases and copies them into the embedded `RoundState` aggregate when safe
- final snapshots are preserved when the state is already ended

## 13. Security considerations and known limitations

### Security
- Strong local secret management is required for `SESSION_SECRET` and admin credentials.
- Analyst invites are bearer credentials and should be transmitted only privately.
- The server does not assume distinct physical people hold the two sessions; it only verifies session binding and document state.
- The frontend should be served over HTTPS in production, and `COOKIE_SECURE` should be enabled when the app is deployed behind TLS.

### Known limitations
- MongoDB does not provide a hard real-time guarantee that the HTTP response will be acknowledged before the wall-clock deadline passes.
- The system guarantees ordering at the database admission point, not physical low-latency response timing.
- The aggregate is subject to MongoDB's 16 MiB BSON document limit; large investigation histories or excessive retained activity volume can exceed this design.
- The implementation intentionally serializes Round 3 writes through a single document rather than a separate multi-document transaction model.

## 14. Integration walkthrough and release checklist

### Recommended integration flow
1. Start MongoDB and configure `.env` values, including the exact frontend origin.
2. Install all dependencies for the root app and the server.
3. Start the backend and verify `GET /api/health` returns `{ "ok": true }`.
4. Start the root Vite app on port 5177. Use `http://localhost:5177/` for team login and `http://localhost:5177/round3_investigation/index.html` for the prototype.
5. Start a Round 3 run from the admin flow.
6. Sign in through the main app with the team's existing credentials in the Lead Detective browser profile.
7. In that same browser profile, open the standalone prototype and claim the detective role.
8. Share the invitation returned by that successful join privately with the analyst's separate browser profile or device.
9. Submit that invitation to join as analyst, then exercise evidence, decryption, accusation, and approval.
10. Observe deadline lock and final snapshot behavior.
11. Verify the admin final-results endpoint returns the committed immutable result.

### Release checklist
- Confirm the service is using a local-only or deployment-safe `SESSION_SECRET`.
- Confirm `FRONTEND_ORIGIN` contains the exact frontend hostnames and ports.
- Confirm team login occurs through the existing main app before the detective joins, and that both pages use the same browser profile and `localhost` hostname for the detective session.
- Confirm the test database is isolated from the dev database.
- Treat the Round 3 prototype as a separate standalone artifact; the root build does not copy it into `dist/`.
- Confirm the prototype's backend URL and allowed frontend origin are configured when testing its backend communication.
- Confirm the admin final-results endpoint is protected by admin auth.
- Confirm the deadline semantics are documented honestly.
- Confirm no unrelated files are staged with the Round 3 patch.

## 15. Summary

The Round 3 design intentionally moves the authoritative deadline and mutation ordering into the MongoDB document write itself. That creates a clean serial ordering point for claim, evidence, decryption, accusation, approval, and closure without relying on a fragile in-memory timer to decide whether a request is still valid. The result is a robust, auditable, single-document Round 3 aggregate that preserves immutability after closure and failure recovery across startup and legacy migration. Its frontend remains a standalone prototype, and scoring rules and integration remain pending a future decision.

The implementation is intentionally explicit about the limits of this approach: it provides atomic ordering and final-result immutability, but it does not claim hard real-time completion or exact HTTP acknowledgment before the wall-clock deadline.