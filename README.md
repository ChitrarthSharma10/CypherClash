# CypherClash

CypherClash is an event-grade web platform and competition engine built for cybersecurity tournament operations. The entire competition lifecycle is managed through a single unified application: team authentication, real-time cooperative mini-games, forensic inspect-element investigations, collaborative dual-role incident response, append-only score ledgers, live leaderboards, and administrative tournament controls.

---

## 1. Tournament Structure & Games

CypherClash features a structured 3-round competitive tournament where all gameplay scores are audited, append-only, and capped at **500 points maximum per game**. Once a team completes a game, it is finalized and cannot be replayed.

### Round 1: Cooperative Mini-Games
1. **Circuit Sync (Logic Challenge)**
   - 5 sequential Boolean gate stages (AND, OR, XOR, NAND, NOR, NOT, XNOR).
   - Trace electrical signal flow, toggle switches (Keys `1`–`6` or buttons), and test circuits (`Enter`).
   - Capped at **500 points max**.
2. **Dual-Control Maze (Co-op Coordination)**
   - Two teammates control one shared avatar through a 3D labyrinth with gates, rune portals, and hazardous spike pits.
   - **Player 1**: Vertical Controls (`W`/`S` or `Up`/`Down`).
   - **Player 2**: Horizontal Controls (`A`/`D` or `Left`/`Right`).
   - Collect data packets, activate portals to open portcullises, and reach the vault exit.
   - Capped at **500 points max**.
3. **Cyber Runner (Reflex & Timing)**
   - High-speed 3-lane co-op obstacle sprint across an infinite cyberway.
   - **Player 1**: Jump (`W`/`Up`) and Slide (`S`/`Down`).
   - **Player 2**: Lane Steering Left (`A`/`Left`) and Right (`D`/`Right`).
   - Collect gold pickups, vault chests, clear sector checkpoints, and cross the finish line.
   - Capped at **500 points max**.

### Round 2: Operation Shadow Beacon (Hidden Clue Investigation)
- 4-stage sequential web UI incident investigation:
  - **Lead 1**: High-Priority Gateway Alert Log analysis.
  - **Lead 2**: Digital Forensic Evidence Desk with 13 photo/document exhibits, timeline correlation, and CCTV analysis.
  - **Lead 3**: Historical Git repository commit ledger inspection via challenge repository link.
  - **Lead 4**: Core Signal Vault with interactive Signal Reconstruction Matrix.
- Features stage-gated resources, answer normalization, wrong-answer penalties (-15 pts), and single-use tactical hints (-25 pts).
- Scoring: $\max(150, 500 - (15 \times \text{wrongAttempts}) - (25 \times \text{hintsUsed}))$. Capped at **500 points max** (floor: 150 pts).

### Round 3: Digital Detective (Collaborative Incident Response)
- Two distinct roles operating on a shared case board:
  - **Lead Detective**: Claims incident room, copies private analyst invite link, submits field evidence.
  - **Forensic Analyst**: Joins via private invite link, decrypts packet payloads with recovery tokens.
- **Accusation Agreement**: Either player can initiate a suspect accusation citing collected evidence; the other player must review and approve it.
- Scoring: $\max(150, 500 - (15 \times \text{wrongAttempts}))$. Capped at **500 points max**.

---

## 2. Quickstart: Clone & Run

> [!CAUTION]
> **DATABASE SAFETY NOTICE**:
> Test teams, sample passwords, seed scripts, and migration helpers are strictly intended for a **LOCAL** development database (`mongodb://127.0.0.1:27017/cypherclash`).
> **NEVER** run seed or delete scripts against a shared production or cloud MongoDB database.

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **MongoDB**: Local MongoDB instance running on port 27017.

### Step 1: Clone Repository
```bash
git clone https://github.com/ChitrarthSharma10/CypherClash.git
cd CypherClash
```

### Step 2: Configure Environment Files
1. **Frontend**:
   ```bash
   cp .env.example .env
   ```
   *(Default: `VITE_API_URL=http://localhost:4000`)*

2. **Backend**:
   ```bash
   cp server/.env.example server/.env
   ```
   *(Ensure `MONGO_URI` points to your local MongoDB instance, e.g. `mongodb://127.0.0.1:27017/cypherclash`, and set a unique `SESSION_SECRET` and `ADMIN_PASSWORD`)*

### Step 3: Install Dependencies
```bash
# Install root (frontend) dependencies
npm install

# Install server (backend) dependencies
cd server
npm install
cd ..
```

### Step 4: Seed Initial Admin & Local Test Teams (Optional)
```bash
cd server
npm run seed
cd ..
```
*Creates default admin credentials and local test accounts (`CC-001`, `CC-002`, `CC-003`).*

### Step 5: Start Servers
Run the backend and frontend in separate terminal windows:

- **Terminal 1 (Backend API)**:
  ```bash
  cd server
  npm run dev
  ```
  *Server starts on `http://localhost:4000`.*

- **Terminal 2 (Frontend Client)**:
  ```bash
  npm run dev
  ```
  *Frontend starts on `http://localhost:5173`.*

---

## 3. Two-Player & Round 3 Testing Guide

### Testing Dual-Control Mini-Games (Maze & Runner)
1. Log in to the Team Dashboard at `http://localhost:5173/login`.
2. Ensure Round 1 is active (start via Admin Portal at `http://localhost:5173/admin/login` if needed).
3. Open Dual-Control Maze or Cyber Runner.
4. **Co-op Testing Options**:
   - **Same Machine**: Use `W`/`S` (Player 1) and `A`/`D` (Player 2) simultaneously on the shared keyboard.
   - **Two Browser Windows**: Open a second browser tab or window, select Player 2 role, and test real-time WebSocket synchronization across windows.
   - **Simulate Partner**: Click "Sync Device / Pair Now ⚡" or use the partner toggle in the lobby.

### Testing Round 3 Collaborative Case
1. Ensure Round 3 is active and the team is eligible.
2. From the Team Dashboard, navigate to **Round 03 / Collaborative Case**.
3. **Player 1**: Click **Claim Lead Detective**. Once claimed, click **Copy Invite Link**.
4. **Player 2**: Open the copied link in a separate browser window or incognito session. Click **Join as Forensic Analyst**.
5. Both players now share the live case board. Player 1 logs field evidence (`ev1`), Player 2 decrypts telemetry packets (`HELIX`), and either player drafts the accusation for the other to approve.

---

## 4. Test & Build Commands

### Backend Test Suite
All backend tests execute strictly against an isolated `_test` database:
```bash
cd server
npm test
```
*Runs all unit and integration test suites covering authentication, session isolation, scoring ledger, game engines, and progression rules.*

### Frontend Production Build
```bash
npm run build
```
*Compiles the production bundle via Vite into `dist/`.*

---

## 5. Security & Architecture Details

- **Independent Session Roles**: Tournament administrators (`cc_admin.sid`) and teams (`cc_team.sid`) use isolated HTTP-only cookies, allowing admins and teams to operate concurrently in separate tabs of the same browser.
- **Single Completion Guarantee**: Once a team completes a game and points are recorded, the game is permanently locked for that round attempt.
- **Score Cap Enforcement**: All game engines and the authoritative server ledger clamp game scores to `Math.min(500, points)`.
- **Append-Only Ledger**: Direct mutations to team score records are prohibited. All score updates flow through the immutable `ScoreEntry` ledger with audit logging.
