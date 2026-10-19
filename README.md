# CypherClash

CypherClash is an event-grade web platform and competition engine built for cybersecurity tournament operations. The entire competition lifecycle is managed through a single unified application: team authentication, real-time cooperative puzzles, inspect-element investigations, append-only score ledgers, live leaderboards, administrative round controls, and team progression overrides.

---

## 1. Project Overview & Architecture

CypherClash is designed for student cybersecurity tournaments where teams compete in-person using a single shared screen and keyboard.

- **One Session Per Team**: Each team receives a unique Team ID (`CC-###`) and password. Per-player accounts are omitted by design; both team members participate on a single shared physical machine.
- **Client/Server Authority Separation**: The browser is strictly a display and input layer. The server exclusively governs identity, timing, validation, stage progression, hint entitlements, score calculation, and persistence.
- **Independent Session Roles**: Tournament administrators and participating teams authenticate using separate session cookies (`cc_admin.sid` and `cc_team.sid`), allowing administrators and teams to remain simultaneously active in the same browser across separate tabs.
- **Auditable Score Ledger**: Scores are never mutated directly. Every score update is recorded as an immutable `ScoreEntry` document in an append-only ledger with an explicit reason, actor, and timestamp.
- **State-Gated Progression**: Round eligibility and tournament progress are separated from the global tournament round clock. Overriding or waiving a team's prerequisites does not alter the global round status or fabricate gameplay points.

```
                    ┌─────────────────────────────────────────┐
                    │      CypherClash Frontend (React/Vite)  │
                    │  - Landing Page     - Team Dashboard    │
                    │  - Circuit Sync     - Operation Beacon  │
                    │  - Live Leaderboard - Admin Control Room│
                    └────────────────────┬────────────────────┘
                                         │ HTTP REST / Polling
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │       CypherClash API (Node/Express)     │
                    │  - Session Auth     - Rate Limiters     │
                    │  - Game Validators  - Progression Engine│
                    │  - Round Timers     - Score Ledger      │
                    └────────────────────┬────────────────────┘
                                         │ Mongoose ODM
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │              MongoDB Database           │
                    │  - Teams            - RoundStates       │
                    │  - GameSessions     - ScoreEntries      │
                    │  - HintEntitlements - TeamProgressions  │
                    │  - EventLogs        - Sessions          │
                    └─────────────────────────────────────────┘
```

---

## 2. Technology Stack

- **Frontend**:
  - React 18+ (SPA with lightweight pathname/history routing)
  - Vite (build tool and dev server)
  - Vanilla CSS design system with responsive dark cyberpunk aesthetics
  - Pure SVG schematic renderer for interactive circuit tracing
- **Backend**:
  - Node.js (ES Modules)
  - Express 5
  - Mongoose 8 (MongoDB ODM)
  - `express-session` & `connect-mongo` (database-backed HTTP-only cookie sessions)
  - `bcryptjs` (secure password hashing)
  - `helmet` (HTTP security headers)
  - `express-rate-limit` (brute-force defense)
  - `zod` (runtime request body schema validation)
  - `cors` (credential-aware cross-origin resource sharing)
  - `dotenv` (environment configuration)
- **Transport**:
  - Stateless HTTP REST endpoints with visibility-aware tab polling (25-second cadence while visible).
  - In-memory server caches for leaderboard snapshots and team presence to prevent database bottlenecks.
  - No WebSockets or Socket.IO required.

---

## 3. Implemented Features & Project Status

### Fully Implemented
- [x] **Authentication & Independent Sessions**: Isolated cookie jars (`cc_admin.sid` for admin, `cc_team.sid` for teams) preventing session collision.
- [x] **Admin Control Room**: Live round controls (start, pause, resume with deadline extension, end, restart attempts), team creation, password resets, login lockout clearance, manual score adjustments, and audit logging.
- [x] **Round 1 — Circuit Sync**: Cooperative Boolean logic puzzle with 5 sequential stages (3, 4, 4, 5, and 6 switches) using AND, OR, XOR, NAND, NOR, NOT, and XNOR gates. Inputs are recorded locally with timestamps and deterministically replayed server-side.
- [x] **Round 2 — Operation Shadow Beacon**: Four-stage web hijacking investigation (Incident Log analysis, rogue relay identification, authentication trace token retrieval, and final beacon neutralization). Features stage-gated resources, answer normalization, wrong-answer penalties, and single-use tactical hints.
- [x] **Team Progression Override & Round Skip System**:
  - *Action A (Advance)*: Advance team to a selected target round with optional prerequisite waivers.
  - *Action B (Waive/Status)*: Configure individual round requirements as `waived`, `pending`, or `completed_normally` (enforces gameplay evidence check).
  - *Action C (Initial Progression)*: Select starting round (Round 1–4) during team creation.
  - *Action D (Safe Revert)*: Revoke overrides safely with disruption warnings if subsequent gameplay records exist.
  - *Audit Trail*: Immutable audit log of all progression overrides displayed in the admin modal.
- [x] **Append-Only Score Ledger**: Atomic `submitGameResult` service with duplicate-submission protection (`teamId + round + attemptNo + game` unique partial index).
- [x] **Live Leaderboard**: Real-time standings computed from verified round score ledger entries; Bias Points displayed separately.

### Placeholders & Pending Work
- [ ] **Dual-Control Maze (Round 1)**: Card disabled; validator returns 501 Not Implemented.
- [ ] **Cyber Runner (Round 1)**: Card disabled; validator returns 501 Not Implemented.
- [ ] **Round 3 Gameplay Challenge**: Challenge engine is in development on a separate integration branch (`origin/feature/round3-investigation`). Shared hint entitlement and progression eligibility check groundwork are implemented and ready for integration.

---

## 4. Game Rules & Scoring Policies

### Round 1: Circuit Sync
- **Format**: 5 sequential Boolean gate stages on a shared screen.
- **Controls**: Keys `1`–`6` (or UI buttons) to toggle switches; `Enter` to test circuit.
- **Scoring**: Maximum **200 points** awarded only after all 5 stages match their target lamps.
- **Validation**: Server re-simulates the exact timestamped switch input log against the session seed.

### Round 2: Operation Shadow Beacon (Hidden Clue Investigation)
- **Format**: 4-stage sequential incident investigation.
  - Stage 1: Security incident log inspection.
  - Stage 2: Rogue relay domain analysis in network traces.
  - Stage 3: Auth trace token extraction from mock portal assets.
  - Stage 4: Beacon neutralization flag verification.
- **Tactical Hint Entitlement**: Exactly one hint available per team for Round 2, imposing an irreversible **-25 point penalty**.
- **Scoring Formula**:
  $$\text{score} = \max(150, 500 - (15 \times \text{wrongAttempts}) - (25 \times \text{hintsUsed}))$$
  - Base score: **500 points**.
  - Incorrect answer submission: **-15 points** per mistake.
  - Hint deduction: **-25 points** (if confirmed).
  - Completion floor: **150 points** (applies only upon successful completion of all four stages; incomplete sessions do not receive completion points).
- **Resource Protection**: Clue resources and download endpoints return HTTP 403 until the preceding stage is solved. Canonical answers and flags are stored strictly on the server.

### Score Ledger & Leaderboard Integrity
- Waived rounds grant **0 points** and record **no fabricated gameplay sessions**.
- Legitimately earned scores are never altered by progression overrides or waiver revocations.
- Total competition rank is determined exclusively by round gameplay points.

---

## 5. Prerequisites

Before running CypherClash locally, ensure you have:
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **MongoDB**: Local MongoDB instance running on port 27017 or a MongoDB Atlas connection URI.

---

## 6. Local Setup & Startup Guide

### Step 1: Clone Repository
```bash
git clone https://github.com/ChitrarthSharma10/CypherClash.git
cd CypherClash
```

### Step 2: Configure Environment Variables

1. **Frontend Environment**:
   Copy `.env.example` to `.env` in the root directory:
   ```bash
   cp .env.example .env
   ```
   *Default contents:*
   ```env
   VITE_API_URL=http://localhost:4000
   ```

2. **Backend Environment**:
   Copy `server/.env.example` to `server/.env`:
   ```bash
   cp server/.env.example server/.env
   ```
   *Edit `server/.env` with your local settings:*
   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/cypherclash
   MONGO_URI_TEST=mongodb://127.0.0.1:27017/cypherclash_test
   SESSION_SECRET=replace-with-a-secure-random-secret-at-least-32-chars
   FRONTEND_ORIGIN=http://localhost:5157
   PORT=4000
   COOKIE_SECURE=false
   COOKIE_SAMESITE=lax
   TRUST_PROXY=0
   BCRYPT_COST=10
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=SetYourAdminPasswordHere123!
   SEED_SAMPLE_TEAMS=false
   ```

### Step 3: Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Step 4: Seed Database (Optional)
To initialize the default administrator account and sample teams:
```bash
cd server
npm run seed
cd ..
```

### Step 5: Start Development Servers
Run the backend and frontend in separate terminal windows:

- **Terminal 1 (Backend API)**:
  ```bash
  cd server
  npm run dev
  ```
  *Backend will listen at `http://localhost:4000`.*

- **Terminal 2 (Frontend Client)**:
  ```bash
  npm run dev -- --port 5157
  ```
  *Frontend will run at `http://localhost:5157`.*

---

## 7. Login & Navigation Workflows

### Admin Portal
- **URL**: `http://localhost:5157/admin/login`
- **Credentials**: Formulated in `server/.env` (`ADMIN_USERNAME` and `ADMIN_PASSWORD`).
- **Features**:
  - Start, pause, resume, and end tournament rounds.
  - Create teams with custom initial progression points (Round 1–4).
  - Open **Manage Progress** on any team to advance rounds, waive requirements, or safely revert exceptions.
  - Clear login lockouts and reset passwords.
  - Adjust team scores with auditable reasons.

### Team Portal
- **URL**: `http://localhost:5157/login`
- **Credentials**: Team ID (`CC-###`) and password generated upon team creation.
- **Features**:
  - Live round countdown and status indicators.
  - Play Circuit Sync (Round 1) and Operation Shadow Beacon (Round 2).
  - Live round score breakdown (distinguishing earned points from waived rounds).
  - Live team presence indicator.
- **Leaderboard**: `http://localhost:5157/leaderboard` (accessible from dashboard).

---

## 8. Verification & Test Commands

### Run Full Backend Test Suite
From the `server/` directory:
```bash
npm test
```
*Executes all 8 test suites (85 automated tests) covering authentication, session isolation, Circuit Sync replay, scoring ledger, investigation lifecycle, progression overrides, and rate limiting.*

### Run Frontend Unit Tests
From the repository root:
```bash
node --test src/circuitSchematicLayout.test.js
```
*Validates schematic layout algorithms, gate coordinate generation, and SVG viewport constraints.*

### Run Frontend Production Build
From the repository root:
```bash
npm run build
```
*Compiles the production bundle via Vite into `dist/` with zero warnings.*

### Check Whitespace & Formatting
From the repository root:
```bash
git diff --check
```

---

## 9. Troubleshooting Tips

- **Session Expiry / 401 Unauthorized**: If cookies are cleared or a team is disabled, refresh the page to trigger session cleanup and redirect to login.
- **Round Inactive / 409 Locked**: Games cannot start unless the corresponding round is marked `running` by the tournament administrator.
- **Prerequisite Missing / 403 Forbidden**: Teams cannot enter Round 2 or Round 3 unless the preceding round was completed normally or administratively waived via the Admin Portal.
- **MongoDB Test Database**: Backend tests use `MONGO_URI_TEST` (or derive `<db>_test`). Ensure MongoDB has permissions to create and drop test collections.
- **Port Conflicts**: Ensure port `4000` (API) and `5157` / `5173` (Vite) are available. Adjust `FRONTEND_ORIGIN` in `server/.env` if using a custom port.
