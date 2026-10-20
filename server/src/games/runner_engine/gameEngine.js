import { GAME_CONFIG } from './config.js';

export class RunnerGameEngine {
  constructor({ sessionId, teamId }, repository, onTick, onGameOver) {
    this.sessionId = sessionId;
    this.teamId = teamId;
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
    
    // Stats & Scoring (Talking Tom Gold Run Spec)
    this.score = 0;
    this.penalties = 0;
    this.collisionsCount = 0;
    this.coinsCollected = 0;
    this.goldBarsCollected = 0;
    this.vaultsCollected = 0;
    this.checkpointsPassed = 0;
    this.agilityBonuses = 0;
    this.stunRemainingSec = 0;
    this.slowdownTimer = 0;
    this.recoveryTimer = 1.0;

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
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.checkpoints = [];

    // Checkpoints at 360m intervals
    for (let cpDist = GAME_CONFIG.CHECKPOINT_INTERVAL_METERS; cpDist <= GAME_CONFIG.COURSE_LENGTH_METERS; cpDist += GAME_CONFIG.CHECKPOINT_INTERVAL_METERS) {
      this.checkpoints.push({
        id: `cp-${cpDist}`,
        distance: cpDist,
        passed: false,
      });
    }

    // Initial friendly run of gold bullion bars at start (28m to 48m in center lane)
    // Guarantees player gets gold upfront without any obstacle collision
    for (let c = 0; c < 5; c++) {
      this.coins.push({
        id: `gold-start-${c}`,
        distance: 28 + c * 4.5,
        lane: 0,
        collected: false,
      });
    }

    // Procedural Highway Obstacles: Hardened for high-speed intense co-op
    // Starts early at 35m with tighter spacing, dual-lane blocks, and rapid combos
    let dist = 35;
    let itemId = 1;
    let nextPowerUpDist = 80;

    while (dist < GAME_CONFIG.COURSE_LENGTH_METERS - 40) {
      const obstacleTypes = ['LOW_HURDLE', 'HIGH_BARRIER', 'TRAIN'];
      const patternRand = Math.random();

      if (patternRand < 0.45) {
        // DUAL-LANE BLOCK (Two lanes obstructed simultaneously!)
        // e.g. Left + Center, or Center + Right, or Left + Right
        const openLane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const blockedLanes = [-1, 0, 1].filter((l) => l !== openLane);

        // First blocked lane has a solid Truck/Train (P2 must dodge)
        this.obstacles.push({
          id: `obs-${itemId++}`,
          type: 'TRAIN',
          distance: dist,
          lane: blockedLanes[0],
          cleared: false,
          hit: false,
        });

        // Second blocked lane has either a Low Hurdle (P1 Jump) or High Barrier (P1 Slide)
        const type2 = Math.random() < 0.5 ? 'LOW_HURDLE' : 'HIGH_BARRIER';
        this.obstacles.push({
          id: `obs-${itemId++}`,
          type: type2,
          distance: dist,
          lane: blockedLanes[1],
          cleared: false,
          hit: false,
        });
      } else if (patternRand < 0.75) {
        // RAPID COMBO SEQUENCE (Two consecutive obstacles 13m apart)
        // e.g. Low Hurdle (Jump) immediately followed by High Barrier (Slide)
        const firstType = Math.random() < 0.5 ? 'LOW_HURDLE' : 'HIGH_BARRIER';
        const secondType = firstType === 'LOW_HURDLE' ? 'HIGH_BARRIER' : 'LOW_HURDLE';
        const comboLane = Math.floor(Math.random() * 3) - 1;

        this.obstacles.push({
          id: `obs-${itemId++}`,
          type: firstType,
          distance: dist,
          lane: comboLane,
          cleared: false,
          hit: false,
        });

        this.obstacles.push({
          id: `obs-${itemId++}`,
          type: secondType,
          distance: dist + 13,
          lane: comboLane,
          cleared: false,
          hit: false,
        });
      } else {
        // SINGLE HIGHWAY HAZARD (Random lane and type)
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        const lane = Math.floor(Math.random() * 3) - 1;

        this.obstacles.push({
          id: `obs-${itemId++}`,
          type,
          distance: dist,
          lane,
          cleared: false,
          hit: false,
        });
      }

      // Gold Bars: Place gold trails in navigable gaps
      const goldLane = Math.floor(Math.random() * 3) - 1;
      const goldCount = 3 + Math.floor(Math.random() * 2);
      for (let c = 0; c < goldCount; c++) {
        this.coins.push({
          id: `gold-${itemId++}`,
          distance: dist + 8 + c * 4,
          lane: goldLane,
          collected: false,
        });
      }

      // Spawn Power-Ups / Stolen Vaults periodically
      if (dist >= nextPowerUpDist && dist < GAME_CONFIG.COURSE_LENGTH_METERS - 80) {
        const puTypes = ['MAGNET', 'DOUBLE_GOLD', 'SHIELD', 'VAULT'];
        const puType = puTypes[Math.floor(Math.random() * puTypes.length)];
        const puLane = Math.floor(Math.random() * 3) - 1;

        this.powerUps.push({
          id: `pu-${itemId++}`,
          type: puType,
          distance: dist + 16,
          lane: puLane,
          collected: false,
        });

        nextPowerUpDist = dist + 130 + Math.random() * 70;
      }

      // Dense tight spacing: 16m to 26m
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
    const goldValue = is2xActive ? GAME_CONFIG.SCORING.GOLD_BAR_VALUE * 2 : GAME_CONFIG.SCORING.GOLD_BAR_VALUE;

    for (const coin of this.coins) {
      if (!coin.collected) {
        const distDiff = Math.abs(this.distanceMeters - coin.distance);
        const inLane = this.currentLane === coin.lane;
        // Magnet pulls gold within 5 meters across all 3 lanes!
        if ((isMagnetActive && distDiff < 5.0) || (inLane && distDiff < 2.5)) {
          coin.collected = true;
          this.coinsCollected++;
          this.goldBarsCollected++;
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
            this.agilityBonuses++;
            this.score += GAME_CONFIG.SCORING.AGILITY_BONUS;
            this.repository.logEvent(this.sessionId, 'OBSTACLE_DODGED', {
              type: obs.type,
              distance: Math.round(this.distanceMeters),
              bonus: GAME_CONFIG.SCORING.AGILITY_BONUS,
            });
          } else if (distDiff <= 1.2 && distDiff >= -0.8) {
            // Physical impact occurs when runner reaches the obstacle without dodging
            obs.hit = true;

            // Check if Helmet / Shield absorbs the collision
            if (this.activePowerUps.shieldTimer > 0) {
              this.activePowerUps.shieldTimer = 0; // Shield breaks but saves the team!
              this.repository.logEvent(this.sessionId, 'SHIELD_ABSORBED_COLLISION', {
                obsId: obs.id,
                type: obs.type,
                distance: Math.round(this.distanceMeters),
              });
            } else {
              this.collisionsCount++;
              const penalty = GAME_CONFIG.SCORING.COLLISION_PENALTY || 20;
              this.penalties += penalty;
              this.score = Math.max(0, this.score - penalty);

              // On hitting an obstacle, slow runner massively for 3 seconds (to ~25% normal speed)
              // Obstacles hit while already slowed must not extend or stack beyond a simple refresh
              this.slowdownTimer = GAME_CONFIG.COLLISION_RECOVERY_TIME_SEC;
              this.recoveryTimer = 0;
              this.stunRemainingSec = GAME_CONFIG.COLLISION_RECOVERY_TIME_SEC;

              // Do NOT restart the level or reset distance. Runner continues forward.
              this.repository.logEvent(this.sessionId, 'COLLISION_PENALTY', {
                obsId: obs.id,
                type: obs.type,
                distance: Math.round(this.distanceMeters),
                penalty,
                score: this.score,
                collisions: this.collisionsCount,
              });
            }
          }
        }
      }
    }

    // Total Score calculation
    const distancePoints = Math.floor(this.distanceMeters * GAME_CONFIG.SCORING.POINTS_PER_METER);
    const vaultPoints = this.vaultsCollected * GAME_CONFIG.SCORING.VAULT_VALUE;
    this.totalCalculatedScore = Math.max(
      0,
      distancePoints +
        this.goldBarsCollected * GAME_CONFIG.SCORING.GOLD_BAR_VALUE +
        vaultPoints +
        this.checkpointsPassed * GAME_CONFIG.SCORING.CHECKPOINT_BONUS +
        this.agilityBonuses * GAME_CONFIG.SCORING.AGILITY_BONUS -
        this.penalties
    );

    // Check Victory (1000m Finish Line Reached)
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

    // Points divided according to the time taken to finish the game:
    // Faster completion yields substantially higher score!
    // Formula: 120,000 / finishTimeSec (e.g. 30s = 4000 pts, 40s = 3000 pts, 60s = 2000 pts, 120s = 1000 pts)
    const timePoints = completed ? Math.round(GAME_CONFIG.SCORING.TIME_POINTS_DIVIDEND / finishTimeSec) : 0;
    const completionBonus = completed ? GAME_CONFIG.SCORING.BASE_COMPLETION_BONUS : 0;

    const baseScore = this.totalCalculatedScore || 0;
    const finalScore = Math.max(0, Math.min(500, baseScore + timePoints + completionBonus));

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
        timeDividend: GAME_CONFIG.SCORING.TIME_POINTS_DIVIDEND,
        coinsCollected: this.coinsCollected,
        collisions: this.collisionsCount,
        checkpointsCleared: this.checkpointsPassed,
        agilityBonuses: this.agilityBonuses,
        completionReason: reason,
        finishTimeSec,
      },
      breakdown: {
        distancePoints: Math.floor(this.distanceMeters * GAME_CONFIG.SCORING.POINTS_PER_METER),
        coinPoints: this.coinsCollected * GAME_CONFIG.SCORING.GOLD_BAR_VALUE,
        checkpointPoints: this.checkpointsPassed * GAME_CONFIG.SCORING.CHECKPOINT_BONUS,
        agilityBonusPoints: this.agilityBonuses * GAME_CONFIG.SCORING.AGILITY_BONUS,
        timePoints,
        completionBonus,
        collisionPenalties: -this.penalties,
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
