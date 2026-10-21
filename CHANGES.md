# Cyber Clash System Updates — Changes & Verification Report

## Overview
This document records surgical updates across Cyber Clash in the four required areas:
1. **Task 4 — Scoring Constants & Deterministic Pools** (Dual-Control Maze & Cyber Runner)
2. **Task 1 — Maze Physics & Solvability Guarantees** (Dual-Control Maze)
3. **Task 2 — Unified Round Timers & Admin Synchronization** (All Games & Rounds 1–3)
4. **Task 3 — Round 3 Unified Workspace** (Digital Detective / Case HELIX merge into single screen)

---

## Files Touched & Why

### Task 4: Scoring Budget & Deterministic Track
- `server/src/games/maze_engine/config.js`:
  - Defined category pools: collectibles (140), checkpoints (60), switches (60), completion (140), speed bonus (≤ 100), with `MAX_GAME_SCORE = 500`.
  - Added layout-independent pool division dynamically at initialization.
  - Set deductions: caught by hunter `-50`, pit `-30`, EMP `-30`, collision `0`.
- `server/src/games/maze_engine/gameEngine.js`:
  - Layout-independent item budget calculation so both `maze-alpha` and `maze-beta` award exactly 500 points for a flawless run.
  - Smooth speed bonus based on par time calculated from layout's shortest path.
  - Floor score at 0. Award collectible/checkpoint/switch only once with no double-awarding after respawn.
- `server/src/games/runner_engine/config.js`:
  - Removed `POINTS_PER_METER` (distance points deleted; distance drives track progress only).
  - Configured deterministic gold budget pool (~250 base, capped with 2X windows), checkpoints 8x10 = 80, vaults = 20, finish = 100, speed bonus ≤ 50 (`MAX_GAME_SCORE = 500`).
  - Collision penalty `-25` with 3-second non-stacking recovery window. Shield absorbs crash without deduction.
- `server/src/games/runner_engine/gameEngine.js`:
  - Seeded PRNG track generation (`createSeededRng` based on attempt session ID).
  - Linear gold scoring (`collected * GOLD_BAR_VALUE * multiplier`).
  - Power-ups: Magnet pulls gold within 5m; 2X doubles gold during timer; Shield absorbs crash; Vault fixed bonus.
  - Clamped running and final scores between 0 and 500.
- `src/games/maze/components/GameManualModal.jsx` & `src/games/maze/components/MapGuidelinesModal.jsx`:
  - Updated scoring manual and guidelines text to match layout-independent budget, par speed bonus, and penalties.
- `src/games/runner/components/GameManualModal.jsx`:
  - Updated rules to state 0 distance points, seeded deterministic gold scaling, 2X multiplier, and shield mechanics.
- `server/test/maze_scoring.test.js` & `server/test/runner_scoring.test.js`:
  - Added unit and 1,000-seed simulation tests verifying flawless run ∈ [450, 500], cap at 500, crash bot ≥ 0, strictly monotonic gold rewards, and zero distance points.

### Task 1: Dual-Control Maze Physics & Solvability
- `server/src/games/maze_engine/validateLayout.js`:
  - Created automated layout validator running BFS flood-fill with progressive unlock: verifies start/exit open, progressive switch-barrier reachability, hazard-free exit path, no items on wall cells, and solution length within time budget.
- `server/src/games/maze_engine/config.js`:
  - Validates all layouts in `MAZE_LAYOUTS` at server boot (throws if any layout fails).
- `server/src/games/maze_engine/gameEngine.js`:
  - Clamped tick `dt` (max 0.05s) with sub-stepping (sub-step size ≤ 0.20 cell) to prevent tunneling even during 500ms lag spikes.
  - Circle-vs-grid cell collision relaxation with character radius `0.35` against all overlapping solid cells and closed barriers. Resolves diagonal corners.
  - Removed unsafe corner glide; added safe penetration push-out.
  - Barrier closing resolution pushes player out to nearest open cell.
  - Hunter moves strictly along BFS cell-centre path with no diagonal corner clipping, cached BFS paths, dormancy until `HUNTER_START_DISTANCE`, and 2-second grace period after respawn to prevent chain-catching.
- `src/games/maze/components/MazeCanvas.jsx`:
  - Render player and hunter using strictly server-authoritative positions with interpolated rendering (no client-side extrapolation through walls).
- `server/test/maze_layout.test.js` & `server/test/maze_engine.test.js`:
  - Verified layout validator on valid layouts, invalid walls, blocked switches, and mandatory hazards.
  - Verified lag spike wall tunneling prevention, bot BFS path completion, hunter wall compliance, and barrier closing overlap resolution.

### Task 2: Synchronized Timers & Admin Duration Enforcement
- `shared/roundTimer.js`:
  - Extracted shared countdown logic (`computeRemainingMs`, `formatTimeLeft`) supporting running, paused, ended states, and server clock offset.
- `src/components/TimeLeftBanner.jsx`:
  - Created reusable `useRoundTimer` hook and updated `TimeLeftBanner` to turn pulsing red under 60 seconds and display "ROUND PAUSED" when paused.
- `src/main.jsx`:
  - Added unified `TimeLeftBanner` to `CircuitSyncGame` and Round 2 `InvestigationGame` header bars.
- `src/games/maze/MazeApp.jsx` & `src/games/runner/RunnerApp.jsx`:
  - Integrated `TimeLeftBanner` into top bar; secondary HUD displays elapsed time stopwatch and synced admin countdown; replaced client `Date.now()` checks with server clock offset.
- `server/src/services/roundState.js`:
  - Removed hard-coded `ROUND3_DURATION_SEC` override in `startRound(round, durationSec)`. Admin duration is now fully honored for Round 1, 2, and 3.
- `server/src/routes/games.js` & `server/src/services/scoring.js`:
  - Enforced round deadline with grace window; allowed incomplete run points to be saved at expiry without dropping points.
- `server/test/round_timer.test.js` & `server/test/rounds_enforcement.test.js`:
  - Validated admin duration for rounds 1–3, pause freezing, deadline resumption, late submission rejection, and incomplete run point persistence.

### Task 3: Round 3 Single-Screen Unified Workspace
- `server/src/games/caseHelix.js`:
  - Set all `CASE_PAGES` and `CASE_PUZZLES` to `role: "both"`. All evidence unlocks based on prerequisite chains rather than seat/role gates.
- `server/src/models/InvestigationCase.js`:
  - Extended enums to accept `"investigator"` role across clues, activity, accusations, and report submissions.
- `server/src/middleware/investigationAuth.js`:
  - Removed role gating. Authenticated team members access unified workspace as investigators. Stale sessions from previous attempt numbers rejected with 403.
- `server/src/routes/round3Investigation.js`:
  - Gating removed on evidence discovery, puzzle submissions, interview follow-ups, decrypt tool, and report submission.
  - Allowed both unified single-player instant report scoring (`Score = max(150, 500 - 15 * wrongAttempts)`) and cooperative partner approvals.
  - Added validation for `rejectedTheories` and `alternativeReasoning`.
- `src/games/investigation/InvestigationApp.jsx`:
  - Rebuilt top-level UI as a single responsive dashboard with persistent HUD (synced timer, score, records discovered, live team activity feed), 8 section tabs (Case Overview, Interviews, Records, Suspects, Forensics, Evidence Board, Submit Clue, Final Verdict), and eliminated role selection modals and split-screen toggles.
- `src/games/investigation/CaseBoard.jsx`:
  - Removed role filters; unlocked all tools, records, and puzzles to any player; displays verified score upon report submission.
- `server/src/services/progression.js`:
  - Fixed Round 3 eligibility check to require team progression prerequisites.
- `server/test/round3_investigation.test.js` & `server/test/caseHelix.test.js`:
  - Added end-to-end unified role-less walkthrough test completing entire case alone, updated availability assertions for unified records, and verified report scoring formula.

---

## Verification Results

### 1. Server Test Suite (`npm test` in `server/`)
```
ℹ tests 163
ℹ suites 0
ℹ pass 163
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 35723.1448
```
All 163 unit and integration tests passed cleanly with 0 failures across:
- `round3_investigation.test.js` (28/28 passed)
- `investigation.test.js` (17/17 passed)
- `rounds_enforcement.test.js` (7/7 passed)
- `round_timer.test.js` (5/5 passed)
- `maze_layout.test.js` (5/5 passed)
- `maze_engine.test.js` (4/4 passed)
- `maze_scoring.test.js` (4/4 passed)
- `runner_scoring.test.js` (1/1 passed - 1,000 seeds)
- `caseHelix.test.js` (4/4 passed)
- Plus progression, leaderboard, auth, and session integration tests.

### 2. Layout Solvability Guarantee
- Standalone execution of `validateLayout`: both `maze-alpha` and `maze-beta` verified solvable.
- Boot validator confirmed active in `server/src/games/maze_engine/config.js`.
- Artificially blocked switch rooms fail with descriptive boot error.

### 3. Maze Physics & Hunter Wall Compliance
- 500ms lag spike stress test: character never tunnels through solid cells or closed barriers.
- 60 simulated seconds hunter chase: hunter centre remains strictly on BFS cell centres within open paths; never inside walls or closed barriers.
- Closing barrier safe push-out resolves player to nearest open cell without trapping or clipping.

### 4. Admin Timer Synchronization
- Custom round durations (e.g. 7 minutes) tested for Rounds 1, 2, and 3: countdown is consistent within ±1s across all game views.
- Admin pause freezes countdown and game physics; resume extends deadline.
- Expiry stops inputs while preserving accumulated points.

### 5. Round 3 Single-Screen Unified Mode
- Single team member completes all 28 records, interviews, puzzles, and submits final report alone without second seat requirement.
- Multi-member teams viewing the case stay synchronized via shared case state and activity feed.

### 6. Scoring Cap & Simulation
- Cyber Runner 1,000-seed simulation confirms flawless run scores ∈ [450, 500], hard-capped at 500.
- Distance gives 0 points; gold bars scale linearly; 2X and Shield mechanics operate cleanly.
- Dual-Control Maze layout-independent pools yield exactly 500 for flawless run on any layout.

### 7. Frontend Production Build (`npm run build`)
```
✓ 77 modules transformed.
dist/index.html                     0.89 kB │ gzip:   0.47 kB
dist/assets/index-HbppZFXF.css    158.92 kB │ gzip:  29.93 kB
dist/assets/index-QaDUYzEk.js   1,152.98 kB │ gzip: 310.27 kB
✓ built in 354ms
```
Frontend built successfully with 0 errors.
