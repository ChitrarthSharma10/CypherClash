import { GAME_CONFIG } from './config.js';

export function createRng(seed) {
  let s = 0;
  if (typeof seed === 'number') {
    s = seed | 0;
  } else {
    const str = String(seed || 'runner-seed-default');
    for (let i = 0; i < str.length; i++) {
      s = (Math.imul(31, s) + str.charCodeAt(i)) | 0;
    }
  }
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RunnerGameEngine {
  constructor({ sessionId, teamId, seed }, repository, onTick, onGameOver) {
    this.sessionId = sessionId;
    this.teamId = teamId;
    this.seed = seed || sessionId || teamId || 'runner-seed-default';
    this.rng = createRng(this.seed);
    this.repository = repository;
    this.onTick = onTick;
    this.onGameOver = onGameOver;

    // Player connection status
    this.players = {
      P1: { connected: false, socketId: null, lastInputTime: 0, role: 'VERTICAL_CONTROLS' },
      P2: { connected: false, socketId: null, lastInputTime: 0, role: 'HORIZONTAL_CONTROLS' },
    };

    // Core Game State
    this.status = 'READY'; // READY | COUNTDOWN | IN_PROGRESS | PAUSED | FINISHED
    this.countdownSec = 0;
    this.distanceMeters = 0;
    this.currentLane = 0;       // -1 (Left), 0 (Center), 1 (Right)
    this.targetLane = 0;
    this.speed = 0;
    this.timeElapsedMs = 0;     // Stopwatch counting UP continuously
    this.respawnNotice = null;

    // Jump & Slide Physics State (Controlled by Player 1)
    this.isJumping = false;
    this.jumpTimer = 0;
    this.jumpY = 0;
    this.isSliding = false;
    this.slideTimer = 0;
    
    // Stats & Scoring (Budgeted strictly <= 500)
    this.score = 0;
    this.goldPoints = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.coinsCollected = 0;
    this.goldBarsCollected = 0;
    this.vaultsCollected = 0;
    this.checkpointsPassed = 0;
    this.stunRemainingSec = 0;
    this.slowdownTimer = 0;
    this.recoveryTimer = 1.0;
    this.goldBarValue = 4; // Computed dynamically during track generation

    // Active Power-Ups Timers (Seconds)
    this.activePowerUps = {
      magnetTimer: 0,
      doubleGoldTimer: 0,
      shieldTimer: 0,
    };

    // Track Items (Obstacles, Gold Bars, PowerUps, Checkpoints)
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.checkpoints = [];
    this.generateTrack();

    // Loop timer
    this.tickInterval = null;
    this.lastTickTime = Date.now();
    this.startedAt = null;
    this.endedAt = null;
  }

  generateTrack() {
    this.rng = createRng(this.seed);
    const rng = this.rng;

    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.checkpoints = [];

    // Checkpoints at 375m intervals (8 total up to 3000m)
    for (let cpDist = GAME_CONFIG.CHECKPOINT_INTERVAL_METERS; cpDist <= GAME_CONFIG.COURSE_LENGTH_METERS; cpDist += GAME_CONFIG.CHECKPOINT_INTERVAL_METERS) {
      this.checkpoints.push({
        id: `cp-${cpDist}`,
        distance: cpDist,
        passed: false,
      });
    }

    // Initial friendly run of gold bullion bars at start (28m to 44m in center lane)
    for (let c = 0; c < 5; c++) {
      this.coins.push({
        id: `gold-start-${c}`,
        distance: 28 + c * 4.0,
        lane: 0,
        collected: false,
      });
    }

    // Fixed deterministic power-up locations across 3000m course
    // Exactly 1 vault (20 pts), 2 double gold (8s duration = 128m max), 1 magnet, 1 shield
    this.powerUps.push(
      { id: 'pu-dg-1', type: 'DOUBLE_GOLD', distance: 480, lane: 0, collected: false },
      { id: 'pu-mag-1', type: 'MAGNET', distance: 1050, lane: -1, collected: false },
      { id: 'pu-vault-1', type: 'VAULT', distance: 1520, lane: 0, collected: false },
      { id: 'pu-dg-2', type: 'DOUBLE_GOLD', distance: 2040, lane: 1, collected: false },
      { id: 'pu-shield-1', type: 'SHIELD', distance: 2500, lane: 0, collected: false }
    );

    // 15 gold clusters of 3 coins each, spaced evenly in clear highway gaps
    // Total coins = 5 start + 15 * 3 = 50 coins
    for (let i = 0; i < 15; i++) {
      const clusterDist = 120 + i * 185 + Math.floor(rng() * 20);
      const clusterLane = Math.floor(rng() * 3) - 1; // -1, 0, or 1
      for (let c = 0; c < 3; c++) {
        this.coins.push({
          id: `gold-${i}-${c}`,
          distance: clusterDist + c * 4,
          lane: clusterLane,
          collected: false,
        });
      }
    }

    // Calculate maximum possible 2X coverage
    // Double Gold lasts 8s. At max speed (16 m/s), runner covers at most 128m.
    const dgPowerUps = this.powerUps.filter((p) => p.type === 'DOUBLE_GOLD');
    let max2xCoins = 0;
    for (const coin of this.coins) {
      const in2xWindow = dgPowerUps.some((pu) => coin.distance >= pu.distance && coin.distance <= pu.distance + 128);
      if (in2xWindow) {
        max2xCoins++;
      }
    }

    const totalGold = this.coins.length; // 50
    const maxUnits = totalGold + max2xCoins; // e.g. 50 + 6 = 56
    // GOLD_BAR_VALUE calibrated so that max possible gold points <= 250
    this.goldBarValue = Math.max(1, Math.floor(GAME_CONFIG.SCORING.GOLD_POOL / maxUnits));

    // Procedural Obstacles placed avoiding power-ups and coin clusters
    let dist = 35;
    let obsId = 1;

    while (dist < GAME_CONFIG.COURSE_LENGTH_METERS - 40) {
      // Don't spawn obstacle right on top of a power-up or vault
      const nearPowerUp = this.powerUps.some((pu) => Math.abs(pu.distance - dist) < 8);
      if (nearPowerUp) {
        dist += 20;
        continue;
      }

      const patternRand = rng();
      if (patternRand < 0.45) {
        // DUAL-LANE BLOCK
        const openLane = Math.floor(rng() * 3) - 1;
        const blockedLanes = [-1, 0, 1].filter((l) => l !== openLane);

        this.obstacles.push({
          id: `obs-${obsId++}`,
          type: 'TRAIN',
          distance: dist,
          lane: blockedLanes[0],
          cleared: false,
          hit: false,
        });

        const type2 = rng() < 0.5 ? 'LOW_HURDLE' : 'HIGH_BARRIER';
        this.obstacles.push({
          id: `obs-${obsId++}`,
          type: type2,
          distance: dist,
          lane: blockedLanes[1],
          cleared: false,
          hit: false,
        });
      } else if (patternRand < 0.75) {
        // RAPID COMBO SEQUENCE
        const firstType = rng() < 0.5 ? 'LOW_HURDLE' : 'HIGH_BARRIER';
        const secondType = firstType === 'LOW_HURDLE' ? 'HIGH_BARRIER' : 'LOW_HURDLE';
        const comboLane = Math.floor(rng() * 3) - 1;

        this.obstacles.push({
          id: `obs-${obsId++}`,
          type: firstType,
          distance: dist,
          lane: comboLane,
          cleared: false,
          hit: false,
        });

        this.obstacles.push({
          id: `obs-${obsId++}`,
          type: secondType,
          distance: dist + 13,
          lane: comboLane,
          cleared: false,
          hit: false,
        });
      } else {
        // SINGLE OBSTACLE
        const obstacleTypes = ['LOW_HURDLE', 'HIGH_BARRIER', 'TRAIN'];
        const type = obstacleTypes[Math.floor(rng() * obstacleTypes.length)];
        const lane = Math.floor(rng() * 3) - 1;

        this.obstacles.push({
          id: `obs-${obsId++}`,
          type,
          distance: dist,
          lane,
          cleared: false,
          hit: false,
        });
      }

      const spacing = Math.max(16, 26 - Math.floor(dist / 140));
      dist += spacing;
    }
  }

  setPlayerConnected(playerId, socketId) {
    const normRole = (playerId === 'P2' || playerId === '2' || playerId === 'PARTICIPANT2') ? 'P2' : 'P1';
    if (this.players[normRole]) {
      this.players[normRole].connected = true;
      this.players[normRole].socketId = socketId;
      this.players[normRole].joinedAt = new Date();
    }
    // Single system play: both roles connected
    this.players.P1.connected = true;
    this.players.P2.connected = true;

    if (this.status === 'WAITING_FOR_PLAYERS' || this.status === 'PAUSED') {
      this.status = 'READY';
    }
  }

  setPlayerDisconnected(playerId) {
    const normRole = (playerId === 'P2' || playerId === '2' || playerId === 'PARTICIPANT2') ? 'P2' : 'P1';
    if (this.players[normRole]) {
      this.players[normRole].connected = false;
      this.players[normRole].socketId = null;
    }
  }

  startGame() {
    this.status = 'COUNTDOWN';
    this.countdownSec = 3.0; // 3-second buffer countdown
    this.distanceMeters = 0;
    this.speed = 0;
    this.score = 0;
    this.goldBarsCollected = 0;
    this.coinsCollected = 0;
    this.vaultsCollected = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.checkpointsPassed = 0;
    this.agilityBonuses = 0;
    this.stunRemainingSec = 0;
    this.slowdownTimer = 0;
    this.recoveryTimer = 1.0;
    this.currentLane = 0;
    this.targetLane = 0;
    this.isJumping = false;
    this.jumpTimer = 0;
    this.jumpY = 0;
    this.isSliding = false;
    this.slideTimer = 0;
    this.activePowerUps = { magnetTimer: 0, doubleGoldTimer: 0, shieldTimer: 0 };
    this.timeElapsedMs = 0;
    this.generateTrack();
    this.startedAt = new Date().toISOString();
    this.lastTickTime = Date.now();

    if (!this.tickInterval) {
      this.tickInterval = setInterval(() => this.tick(), 1000 / GAME_CONFIG.TICK_RATE_HZ);
    }

    this.repository.logEvent(this.sessionId, 'GAME_STARTED', { teamId: this.teamId });
    this.onTick(this.getStatePayload());
  }

  handlePlayerInput(playerId, action) {
    if (this.status !== 'IN_PROGRESS') {
      return { valid: false, reason: 'Game is not active' };
    }

    // Unified single-system actions (JUMP, SLIDE, LEFT, RIGHT)
    if (action === 'JUMP') {
      if (!this.isJumping) {
        this.isJumping = true;
        this.jumpTimer = GAME_CONFIG.JUMP_DURATION_SEC;
        this.isSliding = false;
        this.slideTimer = 0;
        this.repository.logEvent(this.sessionId, 'JUMP_TRIGGERED', { distance: Math.round(this.distanceMeters) });
        return { valid: true, action: 'JUMP' };
      }
      return { valid: true, action: 'JUMP_IN_AIR' };
    }

    if (action === 'SLIDE') {
      this.isSliding = true;
      this.slideTimer = GAME_CONFIG.SLIDE_DURATION_SEC;
      this.isJumping = false;
      this.jumpTimer = 0;
      this.jumpY = 0;
      this.repository.logEvent(this.sessionId, 'SLIDE_TRIGGERED', { distance: Math.round(this.distanceMeters) });
      return { valid: true, action: 'SLIDE' };
    }

    if (action === 'LEFT' || action === 'RIGHT') {
      const dir = action === 'LEFT' ? -1 : 1;
      const newLane = this.targetLane + dir;
      if (newLane < -1 || newLane > 1) {
        return { valid: false, reason: 'Cannot move beyond track boundaries' };
      }

      this.targetLane = newLane;
      this.currentLane = newLane;

      this.repository.logEvent(this.sessionId, 'LANE_CHANGE', {
        playerId,
        direction: action,
        newLane,
        distance: Math.round(this.distanceMeters),
      });

      return { valid: true, newLane };
    }

    return { valid: false, reason: 'Unknown player or action' };
  }

  tick() {
    if (this.status === 'READY') {
      const now = Date.now();
      this.lastTickTime = now;
      this.onTick(this.getStatePayload());
      return;
    }

    if (this.status === 'COUNTDOWN') {
      const now = Date.now();
      const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
      this.lastTickTime = now;

      this.countdownSec = Math.max(0, this.countdownSec - dt);
      if (this.countdownSec <= 0) {
        this.status = 'IN_PROGRESS';
        this.countdownSec = 0;
        this.speed = GAME_CONFIG.BASE_SPEED;
      }
      this.onTick(this.getStatePayload());
      return;
    }

    if (this.status !== 'IN_PROGRESS') return;

    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;

    // Elapsed Stopwatch Timer (Counting UP)
    this.timeElapsedMs += dt * 1000;

    // Clear temporary respawn notice after 1.8s
    if (this.respawnNotice && this.stunRemainingSec <= 0) {
      this.respawnNotice = null;
    }

    // Stun cooldown
    if (this.stunRemainingSec > 0) {
      this.stunRemainingSec = Math.max(0, this.stunRemainingSec - dt);
    }

    // Power-Up Timers Countdown (Talking Tom Gold Run Spec)
    if (this.activePowerUps.magnetTimer > 0) {
      this.activePowerUps.magnetTimer = Math.max(0, this.activePowerUps.magnetTimer - dt);
    }
    if (this.activePowerUps.doubleGoldTimer > 0) {
      this.activePowerUps.doubleGoldTimer = Math.max(0, this.activePowerUps.doubleGoldTimer - dt);
    }
    if (this.activePowerUps.shieldTimer > 0) {
      this.activePowerUps.shieldTimer = Math.max(0, this.activePowerUps.shieldTimer - dt);
    }

    // JUMP Physics (Parabolic arc)
    if (this.isJumping) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) {
        this.isJumping = false;
        this.jumpTimer = 0;
        this.jumpY = 0;
      } else {
        const progress = 1 - this.jumpTimer / GAME_CONFIG.JUMP_DURATION_SEC;
        this.jumpY = Math.sin(progress * Math.PI) * GAME_CONFIG.JUMP_MAX_HEIGHT;
      }
    }

    // SLIDE Physics
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.slideTimer = 0;
      }
    }

    // Base speed and tiers derived from GAME_CONFIG.BASE_SPEED (tunable constant)
    const elapsedSec = this.timeElapsedMs / 1000;
    const base = GAME_CONFIG.BASE_SPEED;
    let targetSpeed = base;
    let tier = 1;

    if (elapsedSec >= 50) {
      tier = 3;
      targetSpeed = base * 1.5;
    } else if (elapsedSec >= 25) {
      tier = 2;
      targetSpeed = base * 1.25;
    } else {
      tier = 1;
      targetSpeed = base;
    }

    if (this.speedTier !== tier) {
      this.speedTier = tier;
      this.repository.logEvent(this.sessionId, 'SPEED_SURGE', {
        tier,
        speed: targetSpeed,
        elapsedSec: Math.round(elapsedSec),
      });
    }

    // Accelerate smoothly towards target tier speed
    if (this.speed < targetSpeed) {
      this.speed = Math.min(targetSpeed, this.speed + 2.0 * dt);
    } else if (this.speed > targetSpeed) {
      this.speed = Math.max(targetSpeed, this.speed - 1.0 * dt);
    }

    // Collision slowdown: massively slow for 3 seconds to 25%, then smoothly return to normal speed
    let speedMultiplier = 1.0;
    if (this.slowdownTimer > 0) {
      this.slowdownTimer = Math.max(0, this.slowdownTimer - dt);
      speedMultiplier = GAME_CONFIG.COLLISION_SLOWDOWN_FACTOR;
      this.recoveryTimer = 0;
    } else if (this.recoveryTimer < 1.0) {
      // Smooth return back to 1.0 over 1 second
      this.recoveryTimer = Math.min(1.0, this.recoveryTimer + dt / 1.0);
      speedMultiplier = GAME_CONFIG.COLLISION_SLOWDOWN_FACTOR + (1.0 - GAME_CONFIG.COLLISION_SLOWDOWN_FACTOR) * this.recoveryTimer;
    }

    let currentSpeed = this.speed * speedMultiplier;

    // Forward progression
    this.distanceMeters += currentSpeed * dt;

    // Checkpoints
    for (const cp of this.checkpoints) {
      if (!cp.passed && this.distanceMeters >= cp.distance) {
        cp.passed = true;
        this.checkpointsPassed++;
        this.score += GAME_CONFIG.SCORING.CHECKPOINT_BONUS;
        this.repository.logEvent(this.sessionId, 'CHECKPOINT_REACHED', {
          id: cp.id,
          distance: cp.distance,
          score: this.score,
        });
      }
    }

    // Gold Bars Collection (With Magnet Attraction and 2X Multiplier)
    const isMagnetActive = this.activePowerUps.magnetTimer > 0;
    const is2xActive = this.activePowerUps.doubleGoldTimer > 0;
    const goldMultiplier = is2xActive ? 2 : 1;
    const goldValue = this.goldBarValue * goldMultiplier;

    for (const coin of this.coins) {
      if (!coin.collected) {
        const distDiff = Math.abs(this.distanceMeters - coin.distance);
        const inLane = this.currentLane === coin.lane;
        // Magnet pulls gold within 5 meters across all 3 lanes!
        if ((isMagnetActive && distDiff < 5.0) || (inLane && distDiff < 2.5)) {
          coin.collected = true;
          this.coinsCollected++;
          this.goldBarsCollected++;
          this.goldPoints += goldValue;
          this.score += goldValue;
        }
      }
    }

    // Power-Ups Collection (Magnet, 2X, Shield, Vault)
    for (const pu of this.powerUps) {
      if (!pu.collected && Math.abs(this.distanceMeters - pu.distance) < 2.5 && this.currentLane === pu.lane) {
        pu.collected = true;
        if (pu.type === 'MAGNET') {
          this.activePowerUps.magnetTimer = GAME_CONFIG.POWER_UPS.MAGNET_DURATION_SEC;
        } else if (pu.type === 'DOUBLE_GOLD') {
          this.activePowerUps.doubleGoldTimer = GAME_CONFIG.POWER_UPS.DOUBLE_GOLD_DURATION_SEC;
        } else if (pu.type === 'SHIELD') {
          this.activePowerUps.shieldTimer = GAME_CONFIG.POWER_UPS.SHIELD_DURATION_SEC;
        } else if (pu.type === 'VAULT') {
          this.vaultsCollected++;
          this.score += GAME_CONFIG.SCORING.VAULT_VALUE;
        }

        this.repository.logEvent(this.sessionId, 'POWERUP_COLLECTED', {
          type: pu.type,
          distance: Math.round(this.distanceMeters),
        });
      }
    }

    // Collision & Dodge Evaluation with Roadblocks, Signs & Trucks
    for (const obs of this.obstacles) {
      // If obstacle is already safely behind the player, mark cleared
      if (this.distanceMeters > obs.distance + 2.5) {
        obs.cleared = true;
        continue;
      }

      if (!obs.hit && !obs.cleared) {
        const distDiff = obs.distance - this.distanceMeters;
        const inLane = this.currentLane === obs.lane;

        // Active dodge / collision interaction zone
        if (inLane && distDiff <= 2.8 && distDiff >= -1.5) {
          let dodged = false;

          if (obs.type === 'LOW_HURDLE') {
            // Low hurdle sawhorse can be cleared by JUMPING over it OR SLIDING under the crossbar!
            if ((this.isJumping && this.jumpY >= 0.4) || this.isSliding) {
              dodged = true;
            }
          } else if (obs.type === 'HIGH_BARRIER') {
            // High overhead gantry can be cleared by SLIDING underneath!
            if (this.isSliding) {
              dodged = true;
            }
          }

          if (dodged) {
            obs.cleared = true;
            this.repository.logEvent(this.sessionId, 'OBSTACLE_DODGED', {
              type: obs.type,
              distance: Math.round(this.distanceMeters),
            });
          } else if (distDiff <= 1.2 && distDiff >= -0.8) {
            // Physical impact occurs when runner reaches the obstacle without dodging
            obs.hit = true;

            // Check if Shield absorbs the collision without penalty or slowdown
            if (this.activePowerUps.shieldTimer > 0) {
              this.activePowerUps.shieldTimer = 0; // Shield consumed but saves the team!
              this.repository.logEvent(this.sessionId, 'SHIELD_ABSORBED_COLLISION', {
                obsId: obs.id,
                type: obs.type,
                distance: Math.round(this.distanceMeters),
              });
            } else {
              this.collisionsCount++;
              const penalty = GAME_CONFIG.SCORING.COLLISION_PENALTY || 25;
              // Collisions during the 3s recovery window must not stack penalties
              if (this.slowdownTimer <= 0) {
                this.penalties += penalty;
                this.score = Math.max(0, this.score - penalty);
              }

              // On hitting an obstacle, slow runner massively for 3 seconds (to ~25% normal speed)
              this.slowdownTimer = GAME_CONFIG.COLLISION_RECOVERY_TIME_SEC;
              this.recoveryTimer = 0;
              this.stunRemainingSec = GAME_CONFIG.COLLISION_RECOVERY_TIME_SEC;

              // Do NOT restart the level or reset distance. Runner continues forward.
              this.repository.logEvent(this.sessionId, 'COLLISION_PENALTY', {
                obsId: obs.id,
                type: obs.type,
                distance: Math.round(this.distanceMeters),
                penalty: this.slowdownTimer <= 0 ? penalty : 0,
                score: this.score,
                collisions: this.collisionsCount,
              });
            }
          }
        }
      }
    }

    // Total Score calculation (strictly no distance points)
    this.totalCalculatedScore = Math.max(0, this.score);

    // Check Victory (3000m Finish Line Reached)
    if (this.distanceMeters >= GAME_CONFIG.COURSE_LENGTH_METERS) {
      this.distanceMeters = GAME_CONFIG.COURSE_LENGTH_METERS;
      this.endGame(true, 'FINISH_LINE_CROSSED');
      return;
    }

    const payload = this.getStatePayload();
    this.onTick(payload);
  }

  getStatePayload() {
    const minD = this.distanceMeters - 20;
    const maxD = this.distanceMeters + 120;

    const visibleObstacles = this.obstacles.filter((o) => o.distance >= minD && o.distance <= maxD);
    const visibleCoins = this.coins.filter((c) => c.distance >= minD && c.distance <= maxD);
    const visiblePowerUps = this.powerUps.filter((p) => p.distance >= minD && p.distance <= maxD);

    const elapsedSec = Math.max(0, this.timeElapsedMs / 1000);
    const speedTier = this.status === 'IN_PROGRESS' ? (elapsedSec >= 60 ? 3 : elapsedSec >= 30 ? 2 : 1) : 1;
    const speedTierLabel = speedTier === 3 ? 'TIER 3 (HYPER SPRINT)' : speedTier === 2 ? 'TIER 2 (SPEED SURGE)' : 'TIER 1 (BASE)';
    const nextSurgeSec = this.status === 'IN_PROGRESS' && speedTier < 3 ? Math.max(0, Math.ceil(30 - (elapsedSec % 30))) : 0;

    return {
      sessionId: this.sessionId,
      teamId: this.teamId,
      status: this.status,
      countdownSec: Math.max(0, parseFloat((this.countdownSec || 0).toFixed(1))),
      countdownDisplay: this.status === 'COUNTDOWN' ? (this.countdownSec > 0.4 ? Math.ceil(this.countdownSec) : 'GO!') : null,
      timeElapsedMs: Math.round(this.timeElapsedMs),
      courseLengthMeters: GAME_CONFIG.COURSE_LENGTH_METERS,
      respawnNotice: this.respawnNotice,
      distanceMeters: parseFloat(this.distanceMeters.toFixed(1)),
      currentLane: this.currentLane,
      targetLane: this.targetLane,
      isJumping: this.isJumping,
      jumpY: parseFloat(this.jumpY.toFixed(2)),
      isSliding: this.isSliding,
      speed: parseFloat((this.stunRemainingSec > 0 ? this.speed * GAME_CONFIG.COLLISION_SLOWDOWN_FACTOR : this.speed).toFixed(1)),
      speedTier,
      speedTierLabel,
      nextSurgeSec,
      score: this.totalCalculatedScore || 0,
      penalties: this.penalties,
      coinsCollected: this.coinsCollected,
      goldBarsCollected: this.goldBarsCollected,
      vaultsCollected: this.vaultsCollected,
      activePowerUps: {
        magnetTimer: parseFloat(this.activePowerUps.magnetTimer.toFixed(1)),
        doubleGoldTimer: parseFloat(this.activePowerUps.doubleGoldTimer.toFixed(1)),
        shieldTimer: parseFloat(this.activePowerUps.shieldTimer.toFixed(1)),
      },
      collisionsCount: this.collisionsCount,
      checkpointsPassed: this.checkpointsPassed,
      totalCheckpoints: this.checkpoints.length,
      isStunned: this.stunRemainingSec > 0,
      visibleObstacles,
      visibleCoins,
      visiblePowerUps,
      players: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
      participants: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
    };
  }

  endGame(completed, reason) {
    if (this.status === 'FINISHED' || this.status === 'TERMINATED') return;

    this.status = completed ? 'FINISHED' : 'TERMINATED';
    this.endedAt = new Date().toISOString();

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    const durationMs = Math.round(this.timeElapsedMs);
    const finishTimeSec = Math.max(1, Math.round(durationMs / 1000));

    // Smooth par-time based speed bonus up to 50 pts
    const parTimeSec = 200; // ~3.3 min par for 3000m at average max speed
    let timePoints = 0;
    let completionBonus = 0;

    if (completed) {
      completionBonus = GAME_CONFIG.SCORING.BASE_COMPLETION_BONUS || 100;
      if (finishTimeSec <= parTimeSec) {
        timePoints = GAME_CONFIG.SCORING.MAX_SPEED_BONUS || 50;
      } else if (finishTimeSec >= 3 * parTimeSec) {
        timePoints = 0;
      } else {
        timePoints = Math.max(0, Math.min(50, Math.round(50 * (1 - (finishTimeSec - parTimeSec) / (2 * parTimeSec)))));
      }
    }

    const baseScore = this.score || 0;
    const finalScore = Math.max(0, Math.min(GAME_CONFIG.MAX_GAME_SCORE || 500, Math.round(baseScore + timePoints + completionBonus)));
    this.score = finalScore;

    const result = {
      gameId: GAME_CONFIG.GAME_ID,
      teamId: this.teamId,
      sessionId: this.sessionId,
      roundId: GAME_CONFIG.ROUND_ID,
      completed,
      score: finalScore,
      penalties: this.penalties,
      durationMs,
      finishTimeSec,
      distanceMeters: Math.round(this.distanceMeters),
      participants: {
        P1: { connected: this.players.P1.connected, role: this.players.P1.role },
        P2: { connected: this.players.P2.connected, role: this.players.P2.role },
      },
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      rawStats: {
        distanceTraveled: Math.round(this.distanceMeters),
        courseLengthMeters: GAME_CONFIG.COURSE_LENGTH_METERS,
        totalCheckpoints: this.checkpoints.length,
        coinsCollected: this.coinsCollected,
        goldBarsCollected: this.goldBarsCollected,
        vaultsCollected: this.vaultsCollected,
        collisions: this.collisionsCount,
        checkpointsCleared: this.checkpointsPassed,
        completionReason: reason,
        finishTimeSec,
      },
      breakdown: {
        goldPoints: this.goldPoints,
        vaultPoints: this.vaultsCollected * (GAME_CONFIG.SCORING.VAULT_VALUE || 20),
        checkpointPoints: this.checkpointsPassed * (GAME_CONFIG.SCORING.CHECKPOINT_BONUS || 10),
        completionBonus,
        timePoints,
        collisionPenalties: -this.penalties,
        earnedTotal: this.goldPoints + this.vaultsCollected * (GAME_CONFIG.SCORING.VAULT_VALUE || 20) + this.checkpointsPassed * (GAME_CONFIG.SCORING.CHECKPOINT_BONUS || 10) + completionBonus + timePoints,
        deductedTotal: this.penalties,
        finalScore,
      },
    };

    this.repository.saveResult(this.sessionId, result);
    this.repository.logEvent(this.sessionId, 'GAME_ENDED', { completed, reason, score: finalScore, finishTimeSec, timePoints });

    this.onGameOver(result);
  }

  adminAction(action) {
    switch (action) {
      case 'play':
      case 'play_game':
      case 'start':
        this.startGame();
        return { success: true, status: this.status, distanceMeters: this.distanceMeters };
      case 'pause':
        if (this.status === 'IN_PROGRESS' || this.status === 'COUNTDOWN') {
          this.status = 'PAUSED';
          if (this.tickInterval) clearInterval(this.tickInterval);
          this.tickInterval = null;
          return { success: true, status: this.status };
        }
        break;
      case 'resume':
        if (this.status === 'PAUSED') {
          this.startGame();
          return { success: true, status: this.status };
        }
        break;
      case 'reset':
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = null;
        this.status = 'READY';
        this.countdownSec = 0;
        this.distanceMeters = 0;
        this.currentLane = 0;
        this.targetLane = 0;
        this.isJumping = false;
        this.jumpTimer = 0;
        this.jumpY = 0;
        this.isSliding = false;
        this.slideTimer = 0;
        this.speed = 0;
        this.score = 0;
        this.goldBarsCollected = 0;
        this.coinsCollected = 0;
        this.vaultsCollected = 0;
        this.penalties = 0;
        this.collisionsCount = 0;
        this.checkpointsPassed = 0;
        this.timeElapsedMs = 0;
        this.respawnNotice = null;
        this.generateTrack();
        this.onTick(this.getStatePayload());
        return { success: true, status: this.status, distanceMeters: 0 };
      case 'end':
        this.endGame(false, 'ADMIN_FORCE_STOP');
        return { success: true, status: this.status };
      case 'finish_win':
        this.distanceMeters = GAME_CONFIG.COURSE_LENGTH_METERS;
        this.endGame(true, 'ADMIN_FORCE_COMPLETE');
        return { success: true, status: this.status };
      default:
        return { error: 'Unknown action' };
    }
  }
}
