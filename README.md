# CypherClash

CypherClash is a cybersecurity student event platform. Read this file before
changing the project. It is the durable project brief for developers and AI
coding agents.

## Product direction

- CypherClash is an event platform for teams of cybersecurity students.
- The current frontend is a React + Vite app.
- The root landing page (`/`) is an established dark cyberpunk/event design.
- Keep the existing landing page content, layout, visual hierarchy, and styles
  intact unless a task explicitly asks for a landing-page change.
- Reuse the existing design language for new screens: dark theme, existing CSS
  variables, Inter for UI text, JetBrains Mono for technical labels, and white
  pill buttons where appropriate.
- Keep visuals simple. Do not add animations unless explicitly requested.
- Do not add game, round, scoring, or leaderboard logic until their specs are
  provided.

## Frontend conventions

- Package manager: npm.
- Build tool: Vite.
- There is no routing package. Existing route handling uses lightweight
  pathname/history behavior; do not install a router without explicit approval.
- The browser talks only to the backend API, never directly to MongoDB.
- Configure the API base URL with `VITE_API_URL`.
- API requests that use sessions must send `credentials: "include"`.
- Never store passwords, session tokens, or authentication data in
  `localStorage` or `sessionStorage`.
- Frontend route guards are only convenience behavior. Server-side authorization
  is the real security boundary.

## Backend conventions

- Backend code belongs under `/server`.
- Stack: Node.js, Express, MongoDB/Mongoose, express-session,
  connect-mongo, bcryptjs, helmet, express-rate-limit, zod, cors, and dotenv.
- Keep API response shapes stable unless a task explicitly requests an API
  change.
- Keep secrets in `server/.env`; never commit them. Use
  `server/.env.example` as the template.
- Passwords must be hashed with bcrypt and plaintext passwords must never be
  stored or logged. Never return password hashes.
- Generated team passwords are displayed only once during team creation or
  password reset.
- Sessions use MongoDB storage, an httpOnly cookie, configurable secure and
  SameSite settings, and a 12-hour expiry.
- Regenerate the session ID on successful login.
- Player authorization must load the player and team from the database. A
  deleted player or inactive team must lose access immediately.
- Admin authorization must come from the server-side session role, never from
  client-supplied role data.
- Validate request bodies strictly with Zod and reject unknown fields.
- Validate team IDs with the established `CC-###`-style pattern.
- Preserve generic login errors so unknown teams, unknown slots, and incorrect
  passwords do not reveal which credential was wrong.
- Keep login rate limiting suitable for a shared college Wi-Fi IP. Preserve
  separate player/admin limiters, failed-attempt accounting, and team/slot
  lockout controls.
- Use `Cache-Control: no-store` for authentication and admin responses.
- Audit security-sensitive admin actions in `EventLog`, including the admin
  actor ID.

## Current API scope

Implemented areas include:

- Player and admin login/logout/session checks.
- Player team dashboard data and heartbeat.
- Admin team creation, listing, editing, enabling/disabling, password reset,
  login-lockout clearing, and event logs.
- Health check endpoint.

Do not add scoring behavior to these endpoints until the rounds specification
is approved.

## Future scoring requirement

When scoring is introduced, do **not** store scoring as only a mutable total.
Every point change must be its own auditable record containing:

- Team
- Round
- Amount
- Reason
- Who made the change
- When it happened

Team totals must be calculated from those point-change records. This supports
auditable and reversible admin bonuses and penalties. Bias Points may remain a
single field for the initial team setup, but competition scoring should use an
append-only point ledger.

## Working rules for AI agents

1. Read this README and inspect the relevant existing code before editing.
2. Make precise, surgical changes and avoid unrelated refactors.
3. Preserve existing frontend behavior and design unless the task explicitly
   changes it.
4. Reuse existing helpers, naming, validation, authorization, and API patterns.
5. Surface errors explicitly; do not silently swallow failures or return
   success-shaped fallbacks.
6. Do not expose secrets, password hashes, session data, or sensitive
   connection strings in responses, logs, documentation, or commits.
7. Update directly related documentation when behavior changes.
8. Run the smallest relevant build, syntax check, or test after changes.
9. List every file created or changed at the end of the task.
10. Ask before making a significant design decision or installing a new
    dependency.

## Local development

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

The frontend defaults to `http://localhost:5173` and the API defaults to
`http://localhost:4000`. MongoDB must be running or configured through
`MONGO_URI`.
