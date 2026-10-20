import { GAME_CONFIG, MAZE_LAYOUTS } from './config.js';

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

    this.status = 'WAITING_FOR_PLAYERS'; // WAITING_FOR_PLAYERS | RUNNING | PAUSED | FINISHED | EXPIRED
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

    this.collectibles = this.layout.collectibles.map((c) => ({ ...c, collected: false }));
    this.checkpoints = this.layout.checkpoints.map((cp) => ({ ...cp, passed: false }));
    this.switches = this.layout.switches.map((sw) => ({ ...sw, active: false, activatedCount: 0 }));
    this.barriers = this.layout.barriers.map((b) => ({ ...b, open: false, openUntil: 0 }));
    this.hazards = (this.layout.hazards || []).map((h) => ({ ...h, active: true }));

    this.score = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.restartsCount = 0;
    this.respawnNotice = null;
    this.portalAlertCount = 0;
    this.portalNotice = null;
    this.timePenaltySeconds = 0;
    this.lastCollisionTime = 0;

    this.timeElapsedMs = 0;
    this.startedAt = null;
    this.endedAt = null;

    this.recentEvents = [];
    this.tickInterval = null;
    this.lastTickTime = null;
  }

  setPlayerConnected(playerId, socketId) {
    const normRole = (playerId === 'P2' || playerId === '2' || playerId === 'PARTICIPANT2') ? 'P2' : 'P1';
    if (this.players[normRole]) {
      this.players[normRole].connected = true;
      this.players[normRole].socketId = socketId;
      this.players[normRole].lastPing = Date.now();
      this.players[normRole].joinedAt = new Date();
    }
    // Single system play: Both participant roles are immediately active
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

    // Auto-start or resume so players are never blocked with 'Game not running'
    if (this.status !== 'RUNNING') {
      this.players.P1.connected = true;
      this.players.P2.connected = true;
      this.startGame();
    }

    const cleanDir = Number(dir);
    if (![-1, 0, 1].includes(cleanDir)) {
      return { valid: false, reason: 'Invalid direction' };
    }

    // Process Movement Input along X (Left/Right) and Y (Up/Down) axes simultaneously
    if (axis === 'Y') {
      this.character.vy = cleanDir;
      return { valid: true };
    } else if (axis === 'X') {
      this.character.vx = cleanDir;
      return { valid: true };
    }

    return { valid: false, reason: 'Unknown axis' };
  }

  startGame() {
    this.status = 'RUNNING';
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
    if (this.status !== 'RUNNING') {
      if (this.onStateUpdate) this.onStateUpdate(this.getStatePayload());
      return;
    }

    const now = Date.now();
    const dt = (now - (this.lastTickTime || now)) / 1000;
    this.lastTickTime = now;

    // Elapsed Stopwatch Timer (Counting UP)
    this.timeElapsedMs += dt * 1000;

    // Update Barriers
    this.barriers.forEach((b) => {
      if (b.open && b.openUntil !== Infinity && now > b.openUntil) {
        b.open = false;
        this.addEvent('BARRIER_CLOSED', `${b.label} closed.`);
      }
    });

    // Character Movement with Server-Side Collision Detection
    const speed = GAME_CONFIG.SPEED;
    const moveX = this.character.vx * speed * dt;
    const moveY = this.character.vy * speed * dt;

    if (moveX !== 0 || moveY !== 0) {
      this.moveWithCollision(moveX, moveY, now);
    }

    // Check Trigger Interactions (Collectibles, Switches, Checkpoints, Exit)
    this.checkTriggers(now);

    // Broadcast State
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getStatePayload());
    }

    // Periodic repository save (every 2 seconds)
    if (!this.lastSaveTime || now - this.lastSaveTime > 2000) {
      this.lastSaveTime = now;
      this.repository.saveProgress(this.sessionId, this.getStatePayload());
    }
  }

  moveWithCollision(moveX, moveY, now) {
    const r = GAME_CONFIG.CHARACTER_RADIUS;
    const testR = r * 0.85;
    let newX = this.character.x + moveX;
    let newY = this.character.y + moveY;
    let collided = false;

    // Test X Axis movement
    if (moveX !== 0) {
      const topBlocked = this.isWallAt(newX + (moveX > 0 ? r : -r), this.character.y - testR);
      const bottomBlocked = this.isWallAt(newX + (moveX > 0 ? r : -r), this.character.y + testR);

      if (topBlocked || bottomBlocked) {
        collided = true;
        // Corner-glide assistance: nudge towards open corridor center
        if (topBlocked && !bottomBlocked) {
          newY += 0.05;
        } else if (bottomBlocked && !topBlocked) {
          newY -= 0.05;
        }
        newX = this.character.x; // Block movement along X
      }
    }

    // Test Y Axis movement (independent of newX to prevent sticky corner deadlock)
    if (moveY !== 0) {
      const leftBlocked = this.isWallAt(this.character.x - testR, newY + (moveY > 0 ? r : -r));
      const rightBlocked = this.isWallAt(this.character.x + testR, newY + (moveY > 0 ? r : -r));

      if (leftBlocked || rightBlocked) {
        collided = true;
        // Corner-glide assistance: nudge towards open corridor center
        if (leftBlocked && !rightBlocked) {
          newX += 0.05;
        } else if (rightBlocked && !leftBlocked) {
          newX -= 0.05;
        }
        newY = this.character.y; // Block movement along Y
      }
    }

    this.character.x = Math.max(r, Math.min(this.layout.width - r, newX));
    this.character.y = Math.max(r, Math.min(this.layout.height - r, newY));

    if (collided) {
      this.handleCollision(now);
    }
  }

  isWallAt(x, y) {
    const col = Math.floor(x);
    const row = Math.floor(y);

    if (row < 0 || row >= this.layout.height || col < 0 || col >= this.layout.width) {
      return true;
    }

    // Check maze grid walls
    if (this.layout.grid[row][col] === 1) {
      return true;
    }

    // Check active (closed) barriers
    for (const b of this.barriers) {
      if (!b.open && b.x === col && b.y === row) {
        return true;
      }
    }

    return false;
  }

  handleCollision(now) {
    if (now - this.lastCollisionTime < GAME_CONFIG.COLLISION_COOLDOWN_MS) {
      return;
    }
    this.lastCollisionTime = now;
    this.collisionsCount++;

    // Wall collision does NOT reduce points as per user requirements
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
    const r = GAME_CONFIG.CHARACTER_RADIUS;

    // 1. Collectibles
    for (const c of this.collectibles) {
      if (!c.collected) {
        const dist = Math.hypot(cx - c.x, cy - c.y);
        if (dist < r + 0.38) {
          c.collected = true;
          const pts = GAME_CONFIG.SCORING.COLLECTIBLE_POINTS;
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
          const pts = GAME_CONFIG.SCORING.CHECKPOINT_POINTS;
          this.score += pts;
          this.addEvent('CHECKPOINT', `Checkpoint cleared: ${cp.name}! +${pts} pts`);
          this.repository.logEvent(this.sessionId, 'CHECKPOINT_PASSED', { id: cp.id, score: this.score });
        }
      }
    }

    // 3. Switches & Barriers (Switches permanently unlock shortcut gates)
    for (const sw of this.switches) {
      const dist = Math.hypot(cx - sw.x, cy - sw.y);
      if (dist < r + 0.45) {
        const target = this.barriers.find((b) => b.id === sw.targetBarrierId);
        if (target) {
          const wasOpen = target.open;
          target.open = true;
          target.openUntil = Infinity; // Permanently unlocked shortcut gate!

          if (!wasOpen) {
            sw.active = true;
            sw.activatedCount++;
            const pts = GAME_CONFIG.SCORING.SWITCH_POINTS;
            this.score += pts;
            this.portalAlertCount = (this.portalAlertCount || 0) + 1;
            this.portalNotice = `⚡ ${sw.label.toUpperCase()} ACTIVATED · ${target.label.toUpperCase()} UNLOCKED!`;
            this.addEvent('SWITCH', `${sw.label} activated! ${target.label} unlocked! (+${pts} pts)`);
            this.repository.logEvent(this.sessionId, 'SWITCH_ACTIVATED', { switchId: sw.id, targetId: target.id });
          }
        }
      }
    }

    // 4. Dig Pit Traps (Sunken Spike Excavations)
    // Character falls into the pit: cannot move ahead of the dig, resets to start and restarts!
    if (this.hazards) {
      for (const pit of this.hazards) {
        const dist = Math.hypot(cx - pit.x, cy - pit.y);
        if (dist < r + (pit.radius || 0.42)) {
          this.handlePitFall(pit, now);
          return; // Stop processing triggers for this tick since game restarted
        }
      }
    }

    // 5. Final Exit
    const exitDist = Math.hypot(cx - this.layout.exit.x, cy - this.layout.exit.y);
    if (exitDist < r + 0.4) {
      this.endGame(true, 'EXIT_REACHED');
    }
  }

  handlePitFall(pit, now) {
    this.restartsCount = (this.restartsCount || 0) + 1;
    this.character.x = this.layout.start.x;
    this.character.y = this.layout.start.y;
    this.character.vx = 0;
    this.character.vy = 0;
    this.score = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.portalAlertCount = 0;
    this.portalNotice = null;

    // Retain collected state: items and checkpoints already claimed remain removed from map
    // so users cannot claim them again or increase their points.
    this.switches.forEach((sw) => {
      sw.active = false;
      sw.activatedCount = 0;
    });
    this.barriers.forEach((b) => {
      b.open = false;
      b.openUntil = 0;
    });

    this.respawnNotice = `⚠️ FELL INTO PIT TRAP · GAME RESTARTED`;
    this.addEvent('PIT_FALL', `Fell into ${pit.label || 'Pit Trap'}! Game restarted from start.`);

    this.repository.logEvent(this.sessionId, 'PIT_FALL', {
      pitId: pit.id,
      restartsCount: this.restartsCount,
      timeElapsedMs: Math.round(this.timeElapsedMs),
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
      completionBonus = GAME_CONFIG.SCORING.COMPLETION_BONUS;
      timePoints = Math.round(GAME_CONFIG.SCORING.TIME_POINTS_DIVIDEND / finishTimeSec);
      this.score = Math.min(500, this.score + completionBonus + timePoints);
      this.addEvent('COMPLETE', `MAZE ESCAPED in ${finishTimeSec}s! +${completionBonus} completion & +${timePoints} time points!`);
    } else {
      this.addEvent('TERMINATED', 'Game terminated. Final score recorded.');
    }

    const collectedCount = this.collectibles.filter((c) => c.collected).length;
    const passedCheckpoints = this.checkpoints.filter((cp) => cp.passed).length;
    const switchesActivated = this.switches.reduce((acc, s) => acc + s.activatedCount, 0);

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
      score: Math.max(0, Math.min(500, Math.round(this.score))),
      penalties: this.penalties,
      breakdown: {
        collectiblesPoints: collectedCount * GAME_CONFIG.SCORING.COLLECTIBLE_POINTS,
        checkpointsPoints: passedCheckpoints * GAME_CONFIG.SCORING.CHECKPOINT_POINTS,
        switchesPoints: switchesActivated * GAME_CONFIG.SCORING.SWITCH_POINTS,
        completionBonus,
        timePoints,
        collisionDeductions: -this.penalties,
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

  // Admin Controls
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
        this.timeElapsedMs = 0;
        this.collectibles.forEach((c) => (c.collected = false));
        this.checkpoints.forEach((cp) => (cp.passed = false));
        this.barriers.forEach((b) => (b.open = false));
        this.status = (this.players.P1.connected && this.players.P2.connected) ? 'RUNNING' : 'WAITING_FOR_PLAYERS';
        this.addEvent('ADMIN', 'Game reset by admin.');
        if (this.status === 'RUNNING') this.startTickLoop();
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
