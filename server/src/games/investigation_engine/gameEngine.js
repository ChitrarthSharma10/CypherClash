import { GAME_CONFIG, INVESTIGATION_SCENARIO } from './config.js';

export class InvestigationGameEngine {
  constructor({ sessionId, teamId }, repository, onTickCallback, onGameOverCallback) {
    this.sessionId = sessionId;
    this.teamId = teamId;
    this.repository = repository;
    this.onTick = onTickCallback;
    this.onGameOver = onGameOverCallback;

    this.scenario = INVESTIGATION_SCENARIO;

    // Participants state
    this.players = {
      P1: { connected: false, socketId: null, role: 'COMMUNICATIONS_ANALYST' },
      P2: { connected: false, socketId: null, role: 'SIEM_INFRA_ANALYST' },
    };

    // Game lifecycle & timer
    this.status = 'WAITING_FOR_PLAYERS'; // WAITING_FOR_PLAYERS, IN_PROGRESS, PAUSED, FINISHED, EXPIRED
    this.timeLimitMs = GAME_CONFIG.TIME_LIMIT_MS;
    this.timeRemainingMs = GAME_CONFIG.TIME_LIMIT_MS;
    this.startedAt = null;
    this.endedAt = null;
    this.timerInterval = null;

    // Stages progression (1 to 4 + 5 for Final Riddle)
    this.currentStage = 1;
    this.stagesCompleted = [false, false, false, false];
    this.stageUnlockedByConnection = [false, false, false, false];

    // Shared Evidence Board connections: array of { from, to, connectedBy, timestamp }
    this.boardConnections = [];
    this.lastConnectionAttempt = { P1: 0, P2: 0 };

    // Counters & Penalties
    this.wrongAttemptsTotal = 0;
    this.wrongAttemptsCurrentStage = 0;
    this.hintsUsedTotal = 0;
    this.stageHintsUsed = [false, false, false, false];
    this.stageCooldownEndsAt = 0; // Epoch ms when cooldown expires
    this.correctConnectionsCount = 0;

    // Scores
    this.score = 0;
    this.penalties = 0;

    // Final case resolution
    this.finalVerdictSubmitted = false;
    this.finalVerdictCorrect = false;
    this.finalCompositeToken = null;
  }

  setPlayerConnected(playerId, socketId) {
    if (this.players[playerId]) {
      this.players[playerId].connected = true;
      this.players[playerId].socketId = socketId;
    }

    // Single system play: both roles immediately active
    this.players.P1.connected = true;
    this.players.P2.connected = true;

    if (this.status === 'WAITING_FOR_PLAYERS') {
      this.startGame();
    }
  }

  setPlayerDisconnected(playerId) {
    if (this.players[playerId]) {
      this.players[playerId].connected = false;
      this.players[playerId].socketId = null;
    }

    if (this.status === 'IN_PROGRESS') {
      this.repository.logEvent(this.sessionId, 'PLAYER_DISCONNECTED', { playerId });
    }
  }

  startGame() {
    if (this.status === 'IN_PROGRESS' || this.status === 'FINISHED') return;

    this.status = 'IN_PROGRESS';
    this.startedAt = new Date();
    this.repository.logEvent(this.sessionId, 'GAME_STARTED', {
      teamId: this.teamId,
      timeLimitMs: this.timeLimitMs,
    });

    this.startTimer();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.status !== 'IN_PROGRESS') return;

      this.timeRemainingMs = Math.max(0, this.timeRemainingMs - 1000);

      // Check if current stage cooldown has expired
      if (this.stageCooldownEndsAt > 0 && Date.now() >= this.stageCooldownEndsAt) {
        this.stageCooldownEndsAt = 0;
        this.wrongAttemptsCurrentStage = 0;
        this.repository.logEvent(this.sessionId, 'COOLDOWN_EXPIRED', {
          stage: this.currentStage,
        });
      }

      // Check if timer expired
      if (this.timeRemainingMs <= 0) {
        this.endGame(false, 'TIME_EXPIRED');
        return;
      }

      // Periodic tick
      if (this.onTick) {
        this.onTick(this);
      }
    }, 1000);
  }

  /**
   * Evidence Connection on the Shared Board
   * Rate limited per player; validates against stage requirements.
   */
  handleConnectEvidence(playerId, sourceId, targetId) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'Game is not in progress' };
    }

    // Rate-limit check
    const now = Date.now();
    const lastAttempt = this.lastConnectionAttempt[playerId] || 0;
    if (now - lastAttempt < GAME_CONFIG.CONNECTION_RATE_LIMIT_MS) {
      return { success: false, reason: 'Please wait before connecting another evidence card.' };
    }
    this.lastConnectionAttempt[playerId] = now;

    if (!sourceId || !targetId || sourceId === targetId) {
      return { success: false, reason: 'Invalid card pairing.' };
    }

    // Normalize link direction
    const linkKey = [sourceId, targetId].sort().join('___');
    const existing = this.boardConnections.some(
      (c) => [c.from, c.to].sort().join('___') === linkKey
    );
    if (existing) {
      return { success: false, reason: 'Cards are already connected on the board.' };
    }

    // Add connection
    this.boardConnections.push({
      from: sourceId,
      to: targetId,
      connectedBy: playerId,
      timestamp: new Date(),
    });

    // Check if this connection satisfies the required connection for the current stage
    let unlockedStageInput = false;
    if (this.currentStage <= 4) {
      const stageConfig = this.scenario.stages[this.currentStage - 1];
      const req = stageConfig.requiredConnection;
      const reqKey = [req.from, req.to].sort().join('___');

      if (linkKey === reqKey) {
        this.stageUnlockedByConnection[this.currentStage - 1] = true;
        unlockedStageInput = true;
        this.correctConnectionsCount++;
        this.score += GAME_CONFIG.SCORING.EVIDENCE_LINK_POINTS;

        this.repository.logEvent(this.sessionId, 'EVIDENCE_CONNECTED_VALID', {
          playerId,
          stage: this.currentStage,
          linkKey,
        });
      }
    }

    this.repository.logEvent(this.sessionId, 'EVIDENCE_LINK_CREATED', {
      playerId,
      sourceId,
      targetId,
    });

    if (this.onTick) this.onTick(this);

    return {
      success: true,
      unlockedStageInput,
      link: { from: sourceId, to: targetId, connectedBy: playerId },
      message: unlockedStageInput
        ? 'Valid evidence link discovered! Clue submission box unlocked.'
        : 'Evidence connection recorded on the investigation board.',
    };
  }

  /**
   * Submits answer for a specific stage.
   * Strictly enforces alternating turns: P1 -> P2 -> P1 -> P2.
   */
  handleSubmitClue(playerId, stageId, rawAnswer) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'Game is not currently active.' };
    }

    if (stageId !== this.currentStage) {
      return { success: false, reason: `Action out of sequence. Current stage is ${this.currentStage}.` };
    }

    if (this.currentStage > 4) {
      return { success: false, reason: 'All intermediate stages cleared. Proceed to final riddle.' };
    }

    const stageConfig = this.scenario.stages[this.currentStage - 1];

    // Single system play: Both players can submit for any stage cooperatively

    // Check if stage is locked by connection
    if (!this.stageUnlockedByConnection[this.currentStage - 1]) {
      return {
        success: false,
        reason: 'You must first identify and connect the required evidence cards on the board.',
      };
    }

    // Check cooldown
    if (this.stageCooldownEndsAt > 0 && Date.now() < this.stageCooldownEndsAt) {
      const remainingSec = Math.ceil((this.stageCooldownEndsAt - Date.now()) / 1000);
      return {
        success: false,
        reason: `Stage currently locked due to exhausted attempts. Cooldown expires in ${remainingSec}s.`,
      };
    }

    const normalized = this.normalizeAnswer(rawAnswer);
    const isCorrect = stageConfig.acceptedVariants.some(
      (v) => this.normalizeAnswer(v) === normalized
    );

    if (isCorrect) {
      // Advance stage
      this.stagesCompleted[this.currentStage - 1] = true;
      this.score += GAME_CONFIG.SCORING.STAGE_POINTS;
      this.wrongAttemptsCurrentStage = 0;
      this.currentStage++;

      this.repository.logEvent(this.sessionId, 'STAGE_CLEARED', {
        stageId,
        playerId,
        scoreAwarded: GAME_CONFIG.SCORING.STAGE_POINTS,
      });

      if (this.onTick) this.onTick(this);

      const nextTurn = this.currentStage <= 4 ? this.scenario.stages[this.currentStage - 1].turn : 'BOTH';

      return {
        success: true,
        cleared: true,
        nextStage: this.currentStage,
        nextTurn,
        message: stageConfig.unlockedNotice,
      };
    } else {
      // Incorrect attempt
      this.wrongAttemptsTotal++;
      this.wrongAttemptsCurrentStage++;
      this.penalties += GAME_CONFIG.SCORING.PENALTY_PER_WRONG_ATTEMPT;
      this.score = Math.max(0, this.score - GAME_CONFIG.SCORING.PENALTY_PER_WRONG_ATTEMPT);

      this.repository.logEvent(this.sessionId, 'WRONG_ATTEMPT', {
        stageId,
        playerId,
        attempt: rawAnswer,
        stageAttempts: this.wrongAttemptsCurrentStage,
      });

      // Check if attempts exhausted
      let cooldownApplied = false;
      if (this.wrongAttemptsCurrentStage >= GAME_CONFIG.MAX_WRONG_ATTEMPTS_PER_STAGE) {
        this.stageCooldownEndsAt = Date.now() + GAME_CONFIG.COOLDOWN_ON_EXHAUSTED_MS;
        cooldownApplied = true;
        this.repository.logEvent(this.sessionId, 'STAGE_COOLDOWN_LOCK', {
          stageId,
          durationMs: GAME_CONFIG.COOLDOWN_ON_EXHAUSTED_MS,
        });
      }

      if (this.onTick) this.onTick(this);

      return {
        success: false,
        cleared: false,
        cooldownApplied,
        attemptsRemaining: Math.max(
          0,
          GAME_CONFIG.MAX_WRONG_ATTEMPTS_PER_STAGE - this.wrongAttemptsCurrentStage
        ),
        reason: cooldownApplied
          ? `3 wrong attempts exhausted! Stage locked for ${Math.round(GAME_CONFIG.COOLDOWN_ON_EXHAUSTED_MS / 1000)}s cooldown.`
          : 'Incorrect clue answer. Review your evidence and team partner notes.',
      };
    }
  }

  /**
   * Request hint for current stage.
   */
  handleRequestHint(playerId, stageId) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'Game not active' };
    }

    if (stageId !== this.currentStage || stageId > 4) {
      return { success: false, reason: 'Hints only available for active intermediate stages' };
    }

    if (this.stageHintsUsed[stageId - 1]) {
      return {
        success: true,
        hint: this.scenario.stages[stageId - 1].hintText,
        alreadyUsed: true,
      };
    }

    this.stageHintsUsed[stageId - 1] = true;
    this.hintsUsedTotal++;
    this.penalties += GAME_CONFIG.SCORING.PENALTY_PER_HINT;
    this.score = Math.max(0, this.score - GAME_CONFIG.SCORING.PENALTY_PER_HINT);

    this.repository.logEvent(this.sessionId, 'HINT_REQUESTED', {
      playerId,
      stageId,
      penalty: GAME_CONFIG.SCORING.PENALTY_PER_HINT,
    });

    if (this.onTick) this.onTick(this);

    return {
      success: true,
      hint: this.scenario.stages[stageId - 1].hintText,
      penalty: GAME_CONFIG.SCORING.PENALTY_PER_HINT,
    };
  }

  /**
   * Final Verdict submission with confirmation.
   */
  handleSubmitVerdict(playerId, verdict, finalToken) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'Game not active' };
    }

    if (this.currentStage < 5) {
      return { success: false, reason: 'Complete stages 1 through 4 before submitting final case verdict.' };
    }

    const normVerdict = (verdict || '').trim().toUpperCase();
    const normToken = this.normalizeAnswer(finalToken || '');

    const finalConfig = this.scenario.finalRiddle;
    const isVerdictCorrect = normVerdict === finalConfig.expectedVerdict;
    const isTokenCorrect = finalConfig.acceptedCompositeVariants.some(
      (v) => this.normalizeAnswer(v) === normToken
    );

    const isTotalCorrect = isVerdictCorrect && isTokenCorrect;

    this.finalVerdictSubmitted = true;
    this.finalVerdictCorrect = isTotalCorrect;
    this.finalCompositeToken = finalToken;

    if (isTotalCorrect) {
      this.score += GAME_CONFIG.SCORING.FINAL_CORRECT_POINTS;
      this.endGame(true, 'CASE_RESOLVED_CORRECTLY');
    } else {
      this.penalties += 100;
      this.score = Math.max(0, this.score - 100);
      this.endGame(false, 'CASE_RESOLVED_INCORRECTLY');
    }

    return {
      success: true,
      isCorrect: isTotalCorrect,
      score: this.score,
    };
  }

  endGame(completed, reason) {
    if (this.status === 'FINISHED' || this.status === 'EXPIRED') return;

    this.status = completed ? 'FINISHED' : reason === 'TIME_EXPIRED' ? 'EXPIRED' : 'FINISHED';
    this.endedAt = new Date();

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Time bonus
    let timeBonus = 0;
    if (completed && this.timeRemainingMs > 0) {
      timeBonus = Math.floor(this.timeRemainingMs / 1000) * GAME_CONFIG.SCORING.TIME_BONUS_PER_SEC;
      this.score += timeBonus;
    }

    const durationMs = this.startedAt ? this.endedAt.getTime() - this.startedAt.getTime() : 0;

    const resultPayload = {
      gameId: GAME_CONFIG.GAME_ID,
      teamId: this.teamId,
      sessionId: this.sessionId,
      roundId: GAME_CONFIG.ROUND_ID,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs,
      completed,
      score: this.score,
      penalties: this.penalties,
      rawStats: {
        stagesCleared: this.stagesCompleted.filter(Boolean).length,
        wrongAttempts: this.wrongAttemptsTotal,
        hintsUsed: this.hintsUsedTotal,
        correctConnections: this.correctConnectionsCount,
        finalCorrect: this.finalVerdictCorrect,
        remainingTimeMs: this.timeRemainingMs,
      },
      breakdown: {
        stagesPoints: this.stagesCompleted.filter(Boolean).length * GAME_CONFIG.SCORING.STAGE_POINTS,
        evidencePoints: this.correctConnectionsCount * GAME_CONFIG.SCORING.EVIDENCE_LINK_POINTS,
        finalVerdictPoints: this.finalVerdictCorrect ? GAME_CONFIG.SCORING.FINAL_CORRECT_POINTS : 0,
        timeBonus,
        penalties: this.penalties,
        finalScore: this.score,
      },
    };

    this.repository.saveResult(this.sessionId, resultPayload);
    this.repository.logEvent(this.sessionId, 'GAME_OVER', { reason, completed, score: this.score });

    if (this.onGameOver) {
      this.onGameOver(resultPayload);
    }
  }

  adminAction(action) {
    switch (action) {
      case 'start':
        this.startGame();
        return { success: true, status: this.status };
      case 'pause':
        this.status = 'PAUSED';
        return { success: true, status: this.status };
      case 'resume':
        this.status = 'IN_PROGRESS';
        return { success: true, status: this.status };
      case 'reset':
        this.timeRemainingMs = this.timeLimitMs;
        this.currentStage = 1;
        this.stagesCompleted = [false, false, false, false];
        this.stageUnlockedByConnection = [false, false, false, false];
        this.boardConnections = [];
        this.wrongAttemptsTotal = 0;
        this.wrongAttemptsCurrentStage = 0;
        this.hintsUsedTotal = 0;
        this.stageHintsUsed = [false, false, false, false];
        this.stageCooldownEndsAt = 0;
        this.score = 0;
        this.penalties = 0;
        this.status = 'WAITING_FOR_PLAYERS';
        return { success: true, status: this.status };
      case 'end':
        this.endGame(false, 'ADMIN_FORCE_END');
        return { success: true, status: this.status };
      default:
        return { success: false, reason: 'Unknown action' };
    }
  }

  /**
   * Helper to normalize user text submissions
   */
  normalizeAnswer(text) {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Role-Filtered State: Player 1 sees ONLY P1 intel, Player 2 sees ONLY P2 intel.
   * Master answers and hidden opponent clues are NEVER exposed over socket.
   */
  getFilteredState(playerId) {
    const isP1 = playerId === 'P1';
    const isP2 = playerId === 'P2';

    // Shared cards on the board
    const evidenceCards = this.scenario.evidenceCards;

    // Current stage public view
    let activeStageInfo = null;
    if (this.currentStage <= 4) {
      const stage = this.scenario.stages[this.currentStage - 1];
      activeStageInfo = {
        stageId: stage.stageId,
        title: stage.title,
        turn: 'COOPERATIVE',
        isMyTurn: true,
        prompt: stage.prompt,
        inputUnlocked: this.stageUnlockedByConnection[this.currentStage - 1],
        requiredConnectionHint: stage.requiredConnection.hint,
        hintAvailable: !this.stageHintsUsed[stage.stageId - 1],
      };
    } else {
      activeStageInfo = {
        stageId: 5,
        title: this.scenario.finalRiddle.title,
        turn: 'BOTH',
        isMyTurn: true,
        prompt: this.scenario.finalRiddle.instructions,
        formatExample: this.scenario.finalRiddle.formatExample,
        inputUnlocked: true,
        hintAvailable: false,
      };
    }

    return {
      gameId: GAME_CONFIG.GAME_ID,
      teamId: this.teamId,
      sessionId: this.sessionId,
      status: this.status,
      timeRemainingMs: this.timeRemainingMs,
      score: this.score,
      penalties: this.penalties,
      currentStage: this.currentStage,
      stagesCompleted: this.stagesCompleted,
      boardConnections: this.boardConnections,
      cooldownRemainingMs: Math.max(0, this.stageCooldownEndsAt - Date.now()),
      wrongAttemptsCurrentStage: this.wrongAttemptsCurrentStage,
      maxWrongAttempts: GAME_CONFIG.MAX_WRONG_ATTEMPTS_PER_STAGE,

      // Participants status
      participants: {
        P1: { connected: true, role: this.players.P1.role },
        P2: { connected: true, role: this.players.P2.role },
      },

      // Shared board cards
      evidenceCards,

      // Current active stage
      activeStage: activeStageInfo,

      // Single Screen Cooperative Dossiers: Both dossiers available
      myDossier: isP2 ? this.scenario.privateDossiers.P2 : this.scenario.privateDossiers.P1,
      dossiers: {
        P1: this.scenario.privateDossiers.P1,
        P2: this.scenario.privateDossiers.P2,
      },
    };
  }
}
