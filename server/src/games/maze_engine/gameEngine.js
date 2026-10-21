import { GAME_CONFIG, MAZE_LAYOUTS } from './config.js';
import { calculateLayoutSolution } from './validateLayout.js';

export class MazeGameEngine {
  constructor(sessionData, repository, onStateUpdate, onGameOver) {
    this.repository = repository;
    this.onStateUpdate = onStateUpdate;
    this.onGameOver = onGameOver;

    this.sessionId = sessionData.sessionId;
    this.teamId = sessionData.teamId;
    this.mazeId = sessionData.mazeId || MAZE_LAYOUTS[0].id;

    const layout = MAZE_LAYOUTS.find((m) => m.id === this.mazeId) || MAZE_LAYOUTS[0];
    this.layout = JSON.parse(JSON.stringify(layout)); // deep copy

    this.status = 'WAITING_FOR_PLAYERS'; // WAITING_FOR_PLAYERS | COUNTDOWN | RUNNING | PAUSED | FINISHED
    this.countdownSec = 0;
    this.players = {
      P1: { connected: false, socketId: null, lastPing: 0, role: 'VERTICAL_CONTROLS' },
      P2: { connected: false, socketId: null, lastPing: 0, role: 'HORIZONTAL_CONTROLS' },
    };

    this.character = {
      x: this.layout.start.x,
      y: this.layout.start.y,
      vx: 0,
      vy: 0,
    };

    this.hunter = {
      x: this.layout.start.x,
      y: this.layout.start.y,
      active: false,
    };

    // Distribute category pools evenly across layout items
    const numCollectibles = (this.layout.collectibles || []).length;
    const cBase = numCollectibles > 0 ? Math.floor(GAME_CONFIG.POOLS.COLLECTIBLES / numCollectibles) : 0;
    const cRem = numCollectibles > 0 ? GAME_CONFIG.POOLS.COLLECTIBLES % numCollectibles : 0;
    this.collectibles = (this.layout.collectibles || []).map((c, idx) => ({
      ...c,
      points: cBase + (idx < cRem ? 1 : 0),
      collected: false,
    }));

    const numCheckpoints = (this.layout.checkpoints || []).length;
    const cpBase = numCheckpoints > 0 ? Math.floor(GAME_CONFIG.POOLS.CHECKPOINTS / numCheckpoints) : 0;
    const cpRem = numCheckpoints > 0 ? GAME_CONFIG.POOLS.CHECKPOINTS % numCheckpoints : 0;
    this.checkpoints = (this.layout.checkpoints || []).map((cp, idx) => ({
      ...cp,
      points: cpBase + (idx < cpRem ? 1 : 0),
      passed: false,
    }));

    const numSwitches = (this.layout.switches || []).length;
    const swBase = numSwitches > 0 ? Math.floor(GAME_CONFIG.POOLS.SWITCHES / numSwitches) : 0;
    const swRem = numSwitches > 0 ? GAME_CONFIG.POOLS.SWITCHES % numSwitches : 0;
    this.switches = (this.layout.switches || []).map((sw, idx) => ({
      ...sw,
      points: swBase + (idx < swRem ? 1 : 0),
      active: false,
      awarded: false,
      activatedCount: 0,
    }));

    this.barriers = (this.layout.barriers || []).map((b) => ({ ...b, open: false, openUntil: 0 }));
    this.hazards = (this.layout.hazards || []).map((h) => ({ ...h, active: true }));

    // Precompute par time from layout shortest solution
    try {
      const sol = calculateLayoutSolution(this.layout, false);
      this.parTimeSec = Math.max(10, Math.round(sol.estimatedSeconds));
    } catch {
      this.parTimeSec = 60;
    }

    this.score = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.hunterCatchesCount = 0;
    this.pitFallsCount = 0;
    this.hazardHitsCount = 0;
    this.restartsCount = 0;
    this.respawnNotice = null;
    this.portalAlertCount = 0;
    this.portalNotice = null;
    this.lastCollisionTime = 0;
    this.hunterGraceUntil = 0;

    this.timeElapsedMs = 0;
    this.startedAt = null;
    this.endedAt = null;

    this.recentEvents = [];
    this.tickInterval = null;
    this.lastTickTime = null;

    this.pathCache = new Map();
  }

  clearPathCache() {
    this.pathCache.clear();
  }

  setPlayerConnected(playerId, socketId) {
    const normRole = (playerId === 'P2' || playerId === '2' || playerId === 'PARTICIPANT2') ? 'P2' : 'P1';
    if (this.players[normRole]) {
      this.players[normRole].connected = true;
      this.players[normRole].socketId = socketId;
      this.players[normRole].lastPing = Date.now();
      this.players[normRole].joinedAt = new Date();
    }
    this.players.P1.connected = true;
    this.players.P2.connected = true;

    this.repository.logEvent(this.sessionId, 'PLAYER_JOINED', { playerId: normRole, socketId, role: this.players[normRole]?.role });

    if (this.status === 'WAITING_FOR_PLAYERS' || this.status === 'PAUSED') {
      this.startGame();
    }

    return true;
  }

  setPlayerDisconnected(playerId) {
    const normRole = (playerId === 'P2' || playerId === '2' || playerId === 'PARTICIPANT2') ? 'P2' : 'P1';
    if (!this.players[normRole]) return;
    this.players[normRole].connected = false;
    this.players[normRole].socketId = null;

    if (normRole === 'P1') this.character.vy = 0;
    if (normRole === 'P2') this.character.vx = 0;

    this.repository.logEvent(this.sessionId, 'PLAYER_DISCONNECTED', { playerId: normRole });
  }

  handlePlayerInput(playerId, axis, dir) {
    if (this.status === 'FINISHED' || this.status === 'TERMINATED') {
      return { valid: false, reason: 'Game finished' };
    }

    if (this.status === 'COUNTDOWN') {
      return { valid: false, reason: 'Round starting in countdown' };
    }

    if (this.status !== 'RUNNING') {
      this.players.P1.connected = true;
      this.players.P2.connected = true;
      this.startGame();
    }

    const cleanDir = Number(dir);
    if (![-1, 0, 1].includes(cleanDir)) {
      return { valid: false, reason: 'Invalid direction' };
    }

    if (axis === 'Y') {
      this.character.vy = cleanDir;
      return { valid: true };
    } else if (axis === 'X') {
      this.character.vx = cleanDir;
      return { valid: true };
    }

    return { valid: false, reason: 'Unknown axis' };
  }

  startGame(skipCountdown = false) {
    if (!skipCountdown && (GAME_CONFIG.START_COUNTDOWN_SEC || 0) > 0) {
      this.status = 'COUNTDOWN';
      this.countdownSec = GAME_CONFIG.START_COUNTDOWN_SEC || 3;
    } else {
      this.status = 'RUNNING';
      this.countdownSec = 0;
    }
    if (!this.startedAt) {
      this.startedAt = new Date().toISOString();
    }
    this.lastTickTime = Date.now();
    this.addEvent('SYSTEM', 'Both agents connected. Dual-Control Maze initiated.');
    this.startTickLoop();
  }

  startTickLoop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    const msPerTick = 1000 / GAME_CONFIG.TICK_RATE_HZ;
    this.tickInterval = setInterval(() => this.tick(), msPerTick);
  }

  stopTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  tick() {
    const now = Date.now();
    // Clamp dt to max 0.05 s to guard against lag spikes
    const rawDt = (now - (this.lastTickTime || now)) / 1000;
    const dt = Math.min(rawDt, 0.05);
    this.lastTickTime = now;

    if (this.status === 'COUNTDOWN') {
      this.countdownSec = Math.max(0, this.countdownSec - dt);
      if (this.countdownSec <= 0) {
        this.status = 'RUNNING';
        this.countdownSec = 0;
        this.addEvent('SYSTEM', 'GO! Dual-Control Maze active.');
      }
      if (this.onStateUpdate) this.onStateUpdate(this.getStatePayload());
      return;
    }

    if (this.status !== 'RUNNING') {
      if (this.onStateUpdate) this.onStateUpdate(this.getStatePayload());
      return;
    }

    // Elapsed Stopwatch Timer
    this.timeElapsedMs += rawDt * 1000;

    // Update Barriers
    this.barriers.forEach((b) => {
      if (b.open && b.openUntil !== Infinity && now > b.openUntil) {
        b.open = false;
        this.addEvent('BARRIER_CLOSED', `${b.label} closed.`);
        this.clearPathCache();
        // If player is inside closing barrier cell, push them out safely
        this.resolveBarrierOverlap(b);
      }
    });

    // Character Movement with Sub-Stepped Circle-Grid Collision Detection
    const speed = GAME_CONFIG.SPEED;
    const moveX = this.character.vx * speed * dt;
    const moveY = this.character.vy * speed * dt;

    if (moveX !== 0 || moveY !== 0) {
      this.moveWithCollision(moveX, moveY, now);
    }

    // Check Trigger Interactions
    this.checkTriggers(now);

    // Authoritative Server Hunter Update
    this.updateHunter(dt, now);

    // Broadcast State
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getStatePayload());
    }

    // Periodic repository save
    if (!this.lastSaveTime || now - this.lastSaveTime > 2000) {
      this.lastSaveTime = now;
      this.repository.saveProgress(this.sessionId, this.getStatePayload());
    }
  }

  isCellSolid(col, row) {
    if (col < 0 || col >= this.layout.width || row < 0 || row >= this.layout.height) {
      return true;
    }
    if (this.layout.grid[row][col] === 1) {
      return true;
    }
    for (const b of this.barriers) {
      if (!b.open && b.x === col && b.y === row) {
        return true;
      }
    }
    return false;
  }

  /**
   * Continuous circle-vs-grid resolution
   */
  resolveCircleGridCollision(entity, radius) {
    const r = radius;
    let collided = false;

    // Run up to 4 relaxation iterations to resolve multi-cell / corner contacts
    for (let iter = 0; iter < 4; iter++) {
      let resolvedInIter = false;
      const minCol = Math.floor(entity.x - r);
      const maxCol = Math.floor(entity.x + r);
      const minRow = Math.floor(entity.y - r);
      const maxRow = Math.floor(entity.y + r);

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          if (!this.isCellSolid(col, row)) continue;

          // Closest point on the solid cell [col, col + 1] x [row, row + 1]
          const qx = Math.max(col, Math.min(col + 1, entity.x));
          const qy = Math.max(row, Math.min(row + 1, entity.y));
          const dx = entity.x - qx;
          const dy = entity.y - qy;
          const dist = Math.hypot(dx, dy);

          if (dist < r) {
            collided = true;
            resolvedInIter = true;
            if (dist > 1e-5) {
              const overlap = r - dist;
              entity.x += (dx / dist) * overlap;
              entity.y += (dy / dist) * overlap;
            } else {
              // Center is inside solid cell: push out to nearest edge
              const toLeft = entity.x - col;
              const toRight = (col + 1) - entity.x;
              const toTop = entity.y - row;
              const toBottom = (row + 1) - entity.y;
              const minEdge = Math.min(toLeft, toRight, toTop, toBottom);

              if (minEdge === toLeft) entity.x = col - r - 1e-4;
              else if (minEdge === toRight) entity.x = col + 1 + r + 1e-4;
              else if (minEdge === toTop) entity.y = row - r - 1e-4;
              else entity.y = row + 1 + r + 1e-4;
            }
          }
        }
      }

      if (!resolvedInIter) break;
    }

    return collided;
  }

  isCircleValid(x, y, radius) {
    const r = radius;
    const minCol = Math.floor(x - r);
    const maxCol = Math.floor(x + r);
    const minRow = Math.floor(y - r);
    const maxRow = Math.floor(y + r);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!this.isCellSolid(col, row)) continue;
        const qx = Math.max(col, Math.min(col + 1, x));
        const qy = Math.max(row, Math.min(row + 1, y));
        if (Math.hypot(x - qx, y - qy) < r - 1e-4) {
          return false;
        }
      }
    }
    return true;
  }

  moveWithCollision(moveX, moveY, now) {
    const r = GAME_CONFIG.CHARACTER_RADIUS || 0.35;
    const totalDist = Math.hypot(moveX, moveY);
    // Sub-step so no step moves more than 0.20 cell (strictly < 0.25)
    const steps = Math.max(1, Math.ceil(totalDist / 0.20));
    const stepX = moveX / steps;
    const stepY = moveY / steps;
    let anyCollision = false;

    for (let s = 0; s < steps; s++) {
      // 1. Move X axis independently
      if (stepX !== 0) {
        this.character.x += stepX;
        const hitX = this.resolveCircleGridCollision(this.character, r);
        if (hitX) {
          anyCollision = true;
          // Corner-glide assistance: gently nudge towards corridor center
          const yCenter = Math.floor(this.character.y) + 0.5;
          const diff = yCenter - this.character.y;
          if (Math.abs(diff) > 0.02) {
            const nudgeY = this.character.y + Math.sign(diff) * Math.min(Math.abs(diff), 0.08);
            if (this.isCircleValid(this.character.x, nudgeY, r)) {
              this.character.y = nudgeY;
            }
          }
        }
      }

      // 2. Move Y axis independently
      if (stepY !== 0) {
        this.character.y += stepY;
        const hitY = this.resolveCircleGridCollision(this.character, r);
        if (hitY) {
          anyCollision = true;
          // Corner-glide assistance: gently nudge towards corridor center
          const xCenter = Math.floor(this.character.x) + 0.5;
          const diff = xCenter - this.character.x;
          if (Math.abs(diff) > 0.02) {
            const nudgeX = this.character.x + Math.sign(diff) * Math.min(Math.abs(diff), 0.08);
            if (this.isCircleValid(nudgeX, this.character.y, r)) {
              this.character.x = nudgeX;
            }
          }
        }
      }
    }

    // Boundary constraints
    this.character.x = Math.max(r, Math.min(this.layout.width - r, this.character.x));
    this.character.y = Math.max(r, Math.min(this.layout.height - r, this.character.y));

    if (anyCollision) {
      this.handleCollision(now);
    }
  }

  resolveBarrierOverlap(barrier) {
    const r = GAME_CONFIG.CHARACTER_RADIUS || 0.35;
    const bx = barrier.x;
    const by = barrier.y;

    // Check if character overlaps barrier cell
    const qx = Math.max(bx, Math.min(bx + 1, this.character.x));
    const qy = Math.max(by, Math.min(by + 1, this.character.y));
    if (Math.hypot(this.character.x - qx, this.character.y - qy) < r) {
      // Find nearest open neighbor cell to push player into safely
      const candidates = [
        [bx - 1, by],
        [bx + 1, by],
        [bx, by - 1],
        [bx, by + 1],
      ].filter(([c, row]) => !this.isCellSolid(c, row));

      if (candidates.length > 0) {
        candidates.sort(([c1, r1], [c2, r2]) => {
          const d1 = Math.hypot(this.character.x - (c1 + 0.5), this.character.y - (r1 + 0.5));
          const d2 = Math.hypot(this.character.x - (c2 + 0.5), this.character.y - (r2 + 0.5));
          return d1 - d2;
        });

        const [bestC, bestR] = candidates[0];
        this.character.x = bestC + 0.5;
        this.character.y = bestR + 0.5;
        this.resolveCircleGridCollision(this.character, r);
      }
    }
  }

  handleCollision(now) {
    if (now - this.lastCollisionTime < GAME_CONFIG.COLLISION_COOLDOWN_MS) {
      return;
    }
    this.lastCollisionTime = now;
    this.collisionsCount++;

    const scorePenalty = GAME_CONFIG.SCORING.COLLISION_SCORE_PENALTY || 0;
    if (scorePenalty > 0) {
      this.score = Math.max(0, this.score - scorePenalty);
      this.penalties += scorePenalty;
      this.addEvent('COLLISION', `Wall collision! -${scorePenalty} pts.`);
    } else {
      this.addEvent('COLLISION', `Wall contact registered (no point loss).`);
    }

    this.repository.logEvent(this.sessionId, 'COLLISION', {
      collisionsCount: this.collisionsCount,
      score: this.score,
      timeElapsedMs: Math.round(this.timeElapsedMs),
    });
  }

  checkTriggers(now) {
    const cx = this.character.x;
    const cy = this.character.y;
    const r = GAME_CONFIG.CHARACTER_RADIUS || 0.35;

    // 1. Collectibles
    for (const c of this.collectibles) {
      if (!c.collected) {
        const dist = Math.hypot(cx - c.x, cy - c.y);
        if (dist < r + 0.38) {
          c.collected = true;
          const pts = c.points;
          this.score += pts;
          this.addEvent('COLLECT', `Data Packet collected! +${pts} pts`);
          this.repository.logEvent(this.sessionId, 'COLLECTIBLE_COLLECTED', { id: c.id, score: this.score });
        }
      }
    }

    // 2. Checkpoints
    for (const cp of this.checkpoints) {
      if (!cp.passed) {
        const dist = Math.hypot(cx - cp.x, cy - cp.y);
        if (dist < r + 0.45) {
          cp.passed = true;
          const pts = cp.points;
          this.score += pts;
          this.addEvent('CHECKPOINT', `Checkpoint cleared: ${cp.name}! +${pts} pts`);
          this.repository.logEvent(this.sessionId, 'CHECKPOINT_PASSED', { id: cp.id, score: this.score });
        }
      }
    }

    // 3. Switches & Barriers
    for (const sw of this.switches) {
      const dist = Math.hypot(cx - sw.x, cy - sw.y);
      if (dist < r + 0.45) {
        const target = this.barriers.find((b) => b.id === sw.targetBarrierId);
        if (target) {
          const wasOpen = target.open;
          target.open = true;
          target.openUntil = Infinity;
          this.clearPathCache();

          if (!wasOpen) {
            sw.active = true;
            sw.activatedCount++;
            let pts = 0;
            if (!sw.awarded) {
              sw.awarded = true;
              pts = sw.points;
              this.score += pts;
            }
            this.portalAlertCount = (this.portalAlertCount || 0) + 1;
            this.portalNotice = `⚡ ${sw.label.toUpperCase()} ACTIVATED · ${target.label.toUpperCase()} UNLOCKED!`;
            this.addEvent('SWITCH', `${sw.label} activated! ${target.label} unlocked! (+${pts} pts)`);
            this.repository.logEvent(this.sessionId, 'SWITCH_ACTIVATED', { switchId: sw.id, targetId: target.id });
          }
        }
      }
    }

    // 4. Hazards (Pits & EMP)
    if (this.hazards) {
      for (const hazard of this.hazards) {
        const dist = Math.hypot(cx - hazard.x, cy - hazard.y);
        if (dist < r + (hazard.radius || 0.42)) {
          this.handleHazardHit(hazard, now);
          return;
        }
      }
    }

    // 5. Final Exit
    const exitDist = Math.hypot(cx - this.layout.exit.x, cy - this.layout.exit.y);
    if (exitDist < r + 0.4) {
      this.endGame(true, 'EXIT_REACHED');
    }
  }

  handleHazardHit(hazard, now) {
    this.restartsCount = (this.restartsCount || 0) + 1;
    const isEmp = hazard.type === 'EMP';
    if (isEmp) {
      this.hazardHitsCount = (this.hazardHitsCount || 0) + 1;
    } else {
      this.pitFallsCount = (this.pitFallsCount || 0) + 1;
    }

    this.character.x = this.layout.start.x;
    this.character.y = this.layout.start.y;
    this.character.vx = 0;
    this.character.vy = 0;

    const penalty = isEmp
      ? (GAME_CONFIG.SCORING.EMP_HAZARD_PENALTY || 30)
      : (GAME_CONFIG.SCORING.PIT_FALL_PENALTY || 30);

    this.penalties += penalty;
    this.score = Math.max(0, this.score - penalty);
    this.portalAlertCount = 0;
    this.portalNotice = null;

    // Grace period after respawn
    this.hunterGraceUntil = now + 2000;
    this.hunter.x = this.layout.start.x;
    this.hunter.y = this.layout.start.y;
    this.hunter.active = false;

    // Items and checkpoints already claimed remain collected so they cannot be double-awarded
    this.switches.forEach((sw) => {
      sw.active = false;
      sw.activatedCount = 0;
    });
    this.barriers.forEach((b) => {
      b.open = false;
      b.openUntil = 0;
    });
    this.clearPathCache();

    this.respawnNotice = `⚠️ ${hazard.label || 'HAZARD'} · -${penalty} PTS PENALTY`;
    this.addEvent('HAZARD', `Hit ${hazard.label || 'Hazard'}! -${penalty} pts penalty. Reset to start.`);

    this.repository.logEvent(this.sessionId, 'HAZARD_HIT', {
      hazardId: hazard.id,
      penalty,
      penaltiesTotal: this.penalties,
      restartsCount: this.restartsCount,
      timeElapsedMs: Math.round(this.timeElapsedMs),
      score: this.score,
    });
  }

  // Alias for backward compatibility
  handlePitFall(pit, now) {
    this.handleHazardHit(pit, now);
  }

  isHunterBlocked(col, row) {
    return this.isCellSolid(col, row);
  }

  getPathDistance(x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return 0;
    const q = [[x1, y1, 0]];
    const visited = new Set([`${x1},${y1}`]);
    while (q.length > 0) {
      const [cx, cy, dist] = q.shift();
      if (cx === x2 && cy === y2) return dist;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        if (!visited.has(key) && !this.isHunterBlocked(nx, ny)) {
          visited.add(key);
          q.push([nx, ny, dist + 1]);
        }
      }
    }
    return Infinity;
  }

  getCachedShortestPathNextCell(startX, startY, targetX, targetY) {
    if (startX === targetX && startY === targetY) return null;
    const key = `${startX},${startY}->${targetX},${targetY}`;
    if (this.pathCache.has(key)) {
      return this.pathCache.get(key);
    }

    const q = [[targetX, targetY]];
    const parent = new Map();
    const visited = new Set([`${targetX},${targetY}`]);

    while (q.length > 0) {
      const [cx, cy] = q.shift();
      if (cx === startX && cy === startY) break;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const cellKey = `${nx},${ny}`;
        if (!visited.has(cellKey) && !this.isHunterBlocked(nx, ny)) {
          visited.add(cellKey);
          parent.set(cellKey, [cx, cy]);
          q.push([nx, ny]);
        }
      }
    }

    const next = parent.get(`${startX},${startY}`);
    const result = next ? { x: next[0], y: next[1] } : null;
    this.pathCache.set(key, result);
    return result;
  }

  getShortestPathNextCell(startX, startY, targetX, targetY) {
    return this.getCachedShortestPathNextCell(startX, startY, targetX, targetY);
  }

  updateHunter(dt, now) {
    if (this.status !== 'RUNNING') return;

    const startCol = Math.floor(this.layout.start.x);
    const startRow = Math.floor(this.layout.start.y);
    const charCol = Math.floor(this.character.x);
    const charRow = Math.floor(this.character.y);

    // If hunter is not yet active, activate once player is at least HUNTER_START_DISTANCE away
    if (!this.hunter.active) {
      const threshold = GAME_CONFIG.HUNTER_START_DISTANCE ?? 3;
      const distFromStart = this.getPathDistance(startCol, startRow, charCol, charRow);
      const directDist = Math.hypot(this.character.x - this.layout.start.x, this.character.y - this.layout.start.y);
      if (distFromStart >= threshold || directDist >= threshold) {
        this.hunter.active = true;
        this.addEvent('HUNTER_ALERT', 'Warning: Hunter detected behind! Keep moving.');
      }
    }

    if (!this.hunter.active) {
      return;
    }

    const hunterSpeed = (GAME_CONFIG.HUNTER_SPEED !== undefined)
      ? GAME_CONFIG.HUNTER_SPEED
      : (GAME_CONFIG.SPEED * (GAME_CONFIG.HUNTER_SPEED_MULTIPLIER ?? 0.85));
    const step = hunterSpeed * dt;

    const hCol = Math.floor(this.hunter.x);
    const hRow = Math.floor(this.hunter.y);

    if (hCol === charCol && hRow === charRow) {
      // In same cell: move directly towards character center
      const dx = this.character.x - this.hunter.x;
      const dy = this.character.y - this.hunter.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        const move = Math.min(step, d);
        this.hunter.x += (dx / d) * move;
        this.hunter.y += (dy / d) * move;
      }
    } else {
      const nextCell = this.getCachedShortestPathNextCell(hCol, hRow, charCol, charRow);
      if (nextCell) {
        const targetX = nextCell.x + 0.5;
        const targetY = nextCell.y + 0.5;

        // Move only along BFS cell-centre path, turning only at cell centres (never diagonally)
        if (nextCell.x !== hCol) {
          // Horizontal step: align Y to corridor center first
          const yCenter = hRow + 0.5;
          const yDiff = yCenter - this.hunter.y;
          if (Math.abs(yDiff) > 0.02) {
            this.hunter.y += Math.sign(yDiff) * Math.min(Math.abs(yDiff), step);
          } else {
            this.hunter.y = yCenter;
            const xDiff = targetX - this.hunter.x;
            this.hunter.x += Math.sign(xDiff) * Math.min(Math.abs(xDiff), step);
          }
        } else {
          // Vertical step: align X to corridor center first
          const xCenter = hCol + 0.5;
          const xDiff = xCenter - this.hunter.x;
          if (Math.abs(xDiff) > 0.02) {
            this.hunter.x += Math.sign(xDiff) * Math.min(Math.abs(xDiff), step);
          } else {
            this.hunter.x = xCenter;
            const yDiff = targetY - this.hunter.y;
            this.hunter.y += Math.sign(yDiff) * Math.min(Math.abs(yDiff), step);
          }
        }
      }
      // If no path, hunter holds position
    }

    // Safety circle collision on hunter with radius <= player's
    const hunterR = (GAME_CONFIG.CHARACTER_RADIUS || 0.35) * 0.85;
    this.resolveCircleGridCollision(this.hunter, hunterR);

    // Check catch condition with grace period check
    const inGrace = this.hunterGraceUntil && now < this.hunterGraceUntil;
    const catchDist = Math.hypot(this.character.x - this.hunter.x, this.character.y - this.hunter.y);
    if (!inGrace && catchDist < 0.55) {
      this.handleHunterCatch(now);
    }
  }

  handleHunterCatch(now) {
    this.restartsCount = (this.restartsCount || 0) + 1;
    this.hunterCatchesCount = (this.hunterCatchesCount || 0) + 1;
    this.character.x = this.layout.start.x;
    this.character.y = this.layout.start.y;
    this.character.vx = 0;
    this.character.vy = 0;

    const penalty = GAME_CONFIG.SCORING.HUNTER_CATCH_PENALTY || 50;
    this.penalties += penalty;
    this.score = Math.max(0, this.score - penalty);

    this.hunter.x = this.layout.start.x;
    this.hunter.y = this.layout.start.y;
    this.hunter.active = false;

    // 2s grace period after respawn to prevent chain-catch
    this.hunterGraceUntil = now + 2000;

    this.portalAlertCount = 0;
    this.portalNotice = null;

    // Items and checkpoints already claimed stay claimed (no double-award, points kept)
    this.switches.forEach((sw) => {
      sw.active = false;
      sw.activatedCount = 0;
    });
    this.barriers.forEach((b) => {
      b.open = false;
      b.openUntil = 0;
    });
    this.clearPathCache();

    this.respawnNotice = `⚠️ CAUGHT BY HUNTER · -${penalty} PTS PENALTY · TIMER RUNNING`;
    this.addEvent('HUNTER_CATCH', `The hunter caught you! -${penalty} pts penalty. Reset to start, timer continues.`);

    this.repository.logEvent(this.sessionId, 'HUNTER_CATCH', {
      restartsCount: this.restartsCount,
      penalty,
      penaltiesTotal: this.penalties,
      timeElapsedMs: Math.round(this.timeElapsedMs),
      score: this.score,
    });
  }

  endGame(completed, reason) {
    this.status = completed ? 'FINISHED' : 'TERMINATED';
    this.endedAt = new Date().toISOString();
    this.stopTickLoop();

    const durationMs = Math.round(this.timeElapsedMs);
    const finishTimeSec = Math.max(1, Math.round(durationMs / 1000));
    let completionBonus = 0;
    let timePoints = 0;

    if (completed) {
      completionBonus = GAME_CONFIG.SCORING.COMPLETION_BONUS || 140;
      const par = this.parTimeSec || 60;
      if (finishTimeSec <= par) {
        timePoints = GAME_CONFIG.SCORING.MAX_SPEED_BONUS || 100;
      } else if (finishTimeSec >= 3 * par) {
        timePoints = 0;
      } else {
        timePoints = Math.max(0, Math.min(100, Math.round(100 * (1 - (finishTimeSec - par) / (2 * par)))));
      }
      this.score = Math.max(0, Math.min(GAME_CONFIG.MAX_GAME_SCORE || 500, Math.round(this.score + completionBonus + timePoints)));
      this.addEvent('COMPLETE', `MAZE ESCAPED in ${finishTimeSec}s! +${completionBonus} completion & +${timePoints} speed bonus!`);
    } else {
      this.score = Math.max(0, Math.min(GAME_CONFIG.MAX_GAME_SCORE || 500, Math.round(this.score)));
      this.addEvent('TERMINATED', 'Game terminated. Final score recorded.');
    }

    const collectedCount = this.collectibles.filter((c) => c.collected).length;
    const passedCheckpoints = this.checkpoints.filter((cp) => cp.passed).length;
    const switchesActivated = this.switches.filter((s) => s.awarded).length;

    const collectiblesPoints = this.collectibles.filter((c) => c.collected).reduce((sum, c) => sum + c.points, 0);
    const checkpointsPoints = this.checkpoints.filter((cp) => cp.passed).reduce((sum, cp) => sum + cp.points, 0);
    const switchesPoints = this.switches.filter((s) => s.awarded).reduce((sum, s) => sum + s.points, 0);

    const standardPayload = {
      gameId: GAME_CONFIG.GAME_ID,
      teamId: this.teamId,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs,
      finishTimeSec,
      completed,
      participants: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
      rawStats: {
        collectibles: collectedCount,
        totalCollectibles: this.collectibles.length,
        checkpoints: passedCheckpoints,
        totalCheckpoints: this.checkpoints.length,
        switchesActivated,
        collisions: this.collisionsCount,
        reachedExit: completed,
        finishTimeSec,
      },
      score: this.score,
      penalties: this.penalties,
      breakdown: {
        collectiblesPoints,
        checkpointsPoints,
        switchesPoints,
        completionBonus,
        timePoints,
        hunterCatchPenalties: (this.hunterCatchesCount || 0) * (GAME_CONFIG.SCORING.HUNTER_CATCH_PENALTY || 50),
        pitFallPenalties: (this.pitFallsCount || 0) * (GAME_CONFIG.SCORING.PIT_FALL_PENALTY || 30),
        hazardPenalties: (this.hazardHitsCount || 0) * (GAME_CONFIG.SCORING.EMP_HAZARD_PENALTY || 30),
        penaltiesDeduction: -this.penalties,
        earnedTotal: collectiblesPoints + checkpointsPoints + switchesPoints + completionBonus + timePoints,
        deductedTotal: this.penalties,
        finalScore: this.score,
      },
    };

    this.repository.saveResult(this.sessionId, standardPayload);
    this.repository.saveProgress(this.sessionId, this.getStatePayload());
    this.repository.logEvent(this.sessionId, 'GAME_OVER', { reason, result: standardPayload });

    if (this.onGameOver) {
      this.onGameOver(standardPayload);
    }
  }

  addEvent(type, message) {
    const ev = { id: Date.now() + Math.random(), type, message, time: new Date().toLocaleTimeString() };
    this.recentEvents.unshift(ev);
    if (this.recentEvents.length > 8) this.recentEvents.pop();
  }

  adminAction(action) {
    switch (action) {
      case 'pause':
        if (this.status === 'RUNNING') {
          this.status = 'PAUSED';
          this.addEvent('ADMIN', 'Game paused by admin override.');
          return { success: true, status: this.status };
        }
        break;
      case 'resume':
        if (this.status === 'PAUSED') {
          this.status = 'RUNNING';
          this.lastTickTime = Date.now();
          this.addEvent('ADMIN', 'Game resumed by admin override.');
          return { success: true, status: this.status };
        }
        break;
      case 'end':
        this.endGame(false, 'ADMIN_TERMINATED');
        return { success: true, status: this.status };
      case 'reset':
        this.stopTickLoop();
        this.character.x = this.layout.start.x;
        this.character.y = this.layout.start.y;
        this.character.vx = 0;
        this.character.vy = 0;
        this.score = 0;
        this.penalties = 0;
        this.collisionsCount = 0;
        this.hunterCatchesCount = 0;
        this.pitFallsCount = 0;
        this.hazardHitsCount = 0;
        this.timeElapsedMs = 0;
        this.collectibles.forEach((c) => (c.collected = false));
        this.checkpoints.forEach((cp) => (cp.passed = false));
        this.switches.forEach((sw) => {
          sw.active = false;
          sw.awarded = false;
          sw.activatedCount = 0;
        });
        this.barriers.forEach((b) => (b.open = false));
        this.hunter.x = this.layout.start.x;
        this.hunter.y = this.layout.start.y;
        this.hunter.active = false;
        this.hunterGraceUntil = 0;
        this.clearPathCache();
        this.status = (this.players.P1.connected && this.players.P2.connected) ? 'COUNTDOWN' : 'WAITING_FOR_PLAYERS';
        this.countdownSec = (GAME_CONFIG.START_COUNTDOWN_SEC || 3);
        this.addEvent('ADMIN', 'Game reset by admin.');
        if (this.status === 'COUNTDOWN') this.startTickLoop();
        return { success: true, status: this.status };
      default:
        return { success: false, reason: 'Invalid admin action' };
    }
    return { success: false, reason: `Cannot execute ${action} in status ${this.status}` };
  }

  getStatePayload() {
    return {
      gameId: GAME_CONFIG.GAME_ID,
      sessionId: this.sessionId,
      teamId: this.teamId,
      status: this.status,
      countdownSec: Math.max(0, parseFloat((this.countdownSec || 0).toFixed(1))),
      countdownDisplay: this.status === 'COUNTDOWN' ? (this.countdownSec > 0.4 ? Math.ceil(this.countdownSec) : 'GO!') : null,
      layout: {
        id: this.layout.id,
        name: this.layout.name,
        width: this.layout.width,
        height: this.layout.height,
        grid: this.layout.grid,
        start: this.layout.start,
        exit: this.layout.exit,
      },
      players: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
      participants: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
      character: {
        x: Number(this.character.x.toFixed(3)),
        y: Number(this.character.y.toFixed(3)),
        vx: this.character.vx,
        vy: this.character.vy,
      },
      hunter: {
        x: Number(this.hunter.x.toFixed(3)),
        y: Number(this.hunter.y.toFixed(3)),
        active: this.hunter.active,
      },
      collectibles: this.collectibles,
      checkpoints: this.checkpoints,
      switches: this.switches,
      barriers: this.barriers.map((b) => ({
        ...b,
        remainingOpenMs: b.open ? Math.max(0, b.openUntil - Date.now()) : 0,
      })),
      hazards: this.hazards || [],
      score: this.score,
      penalties: this.penalties,
      collisionsCount: this.collisionsCount,
      restartsCount: this.restartsCount || 0,
      respawnNotice: this.respawnNotice || null,
      portalAlertCount: this.portalAlertCount || 0,
      portalNotice: this.portalNotice || null,
      timeElapsedMs: Math.round(this.timeElapsedMs),
      recentEvents: this.recentEvents,
    };
  }
}
