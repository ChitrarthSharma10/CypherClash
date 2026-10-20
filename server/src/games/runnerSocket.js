import { RunnerGameEngine } from './runner_engine/gameEngine.js';
import { submitGameResult } from '../services/scoring.js';
import { logEvent } from '../utils/logging.js';
import { getRoundState, onRoundStateChange } from '../services/roundState.js';

class MemoryRunnerRepository {
  constructor() {
    this.progress = new Map();
    this.results = new Map();
    this.events = new Map();
  }
  logEvent(sessionId, eventType, data) {
    if (!this.events.has(sessionId)) this.events.set(sessionId, []);
    this.events.get(sessionId).push({ eventType, data, timestamp: new Date() });
  }
  saveProgress(sessionId, state) {
    this.progress.set(sessionId, state);
  }
  saveResult(sessionId, result) {
    this.results.set(sessionId, result);
  }
}

const repository = new MemoryRunnerRepository();
const activeEngines = new Map(); // keyed by teamId

export function isRound1Running() {
  const r1 = getRoundState(1);
  return Boolean(r1 && r1.status === 'running' && r1.deadline && new Date(r1.deadline).getTime() > Date.now());
}

export function setupRunnerRoundListener(io) {
  onRoundStateChange((state) => {
    if (state.round !== 1) return;
    if (state.status === 'paused') {
      for (const [teamId, engine] of activeEngines.entries()) {
        engine.adminAction('pause');
        io.to(teamId).emit('runner:room_status', {
          p1Connected: engine.players.P1.connected,
          p2Connected: engine.players.P2.connected,
          status: 'PAUSED',
          message: 'Round 1 is paused by administrator',
        });
        io.to(teamId).emit('runner:game_tick', engine.getStatePayload());
      }
    } else if (state.status === 'running') {
      for (const [teamId, engine] of activeEngines.entries()) {
        if (engine.status === 'PAUSED') {
          engine.adminAction('resume');
          io.to(teamId).emit('runner:room_status', {
            p1Connected: engine.players.P1.connected,
            p2Connected: engine.players.P2.connected,
            status: engine.status,
          });
          io.to(teamId).emit('runner:game_tick', engine.getStatePayload());
        }
      }
    } else if (state.status === 'ended') {
      for (const [teamId, engine] of activeEngines.entries()) {
        engine.adminAction('end');
        io.to(teamId).emit('runner:room_status', {
          p1Connected: engine.players.P1.connected,
          p2Connected: engine.players.P2.connected,
          status: 'ENDED',
          message: 'Round 1 has ended',
        });
        io.to(teamId).emit('runner:game_tick', engine.getStatePayload());
      }
      activeEngines.clear();
    }
  });
}

export function getOrCreateRunnerEngine(io, teamId, sessionId = `runner_${teamId}`) {
  if (activeEngines.has(teamId)) {
    return activeEngines.get(teamId);
  }

  const engine = new RunnerGameEngine(
    { sessionId, teamId },
    repository,
    (state) => {
      io.to(teamId).emit('runner:game_tick', state);
    },
    async (finalResult) => {
      io.to(teamId).emit('runner:game_over', finalResult);
      try {
        const rawScore = finalResult.score ?? finalResult.finalScore ?? 0;
        const points = Math.max(0, Math.min(1000, Math.round(rawScore)));
        await submitGameResult(teamId, 'runner', points);
        await logEvent({
          type: 'game score submitted',
          actorType: 'system',
          actorId: 'runner-engine',
          teamId,
          details: { game: 'runner', points },
        });
      } catch (err) {
        console.warn(`[Runner] Score submission for team ${teamId}: ${err.message}`);
      }
    }
  );

  activeEngines.set(teamId, engine);
  return engine;
}

export function registerRunnerHandlers(io, socket) {
  socket.on('runner:join_room', ({ teamId, sessionId, playerId, isRefresh }) => {
    if (!teamId) {
      socket.emit('runner:error_message', { message: 'teamId is required' });
      return;
    }

    if (!isRound1Running()) {
      socket.emit('runner:error_message', { message: 'Round 1 is not running' });
      socket.emit('runner:room_status', {
        p1Connected: false,
        p2Connected: false,
        status: 'LOCKED',
        message: 'Round 1 is not running',
      });
      return;
    }

    const normPlayerId = (playerId === 'P2' || playerId === '2' || String(playerId).toLowerCase().includes('2')) ? 'P2' : 'P1';
    socket.data.runnerTeamId = teamId;
    socket.data.runnerPlayerId = normPlayerId;

    socket.join(teamId);

    const engine = getOrCreateRunnerEngine(io, teamId, sessionId);

    if (isRefresh || engine.status === 'FINISHED' || engine.status === 'EXPIRED') {
      engine.adminAction('reset');
    }

    engine.setPlayerConnected(normPlayerId, socket.id);

    io.to(teamId).emit('runner:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
      participants: {
        P1: { connected: engine.players.P1.connected, role: 'VERTICAL_CONTROLS' },
        P2: { connected: engine.players.P2.connected, role: 'HORIZONTAL_CONTROLS' },
      },
    });

    socket.emit('runner:game_tick', engine.getStatePayload());
  });

  socket.on('runner:play_game', ({ teamId }) => {
    const tId = teamId || socket.data.runnerTeamId;
    if (!tId) return;

    if (!isRound1Running()) {
      socket.emit('runner:error_message', { message: 'Round 1 is not running' });
      return;
    }

    let engine = activeEngines.get(tId);
    if (!engine) engine = getOrCreateRunnerEngine(io, tId, sessionId);
    if (!engine) return;
    engine.startGame();
  });

  socket.on('runner:reset_game', ({ teamId, sessionId }) => {
    const tId = teamId || socket.data.runnerTeamId;
    if (!tId) return;
    let engine = activeEngines.get(tId);
    if (!engine) engine = getOrCreateRunnerEngine(io, tId, sessionId);
    if (!engine) return;
    engine.adminAction('reset');
  });

  socket.on('runner:restart_game', ({ teamId, sessionId }) => {
    const tId = teamId || socket.data.runnerTeamId;
    if (!tId) return;

    if (!isRound1Running()) {
      socket.emit('runner:error_message', { message: 'Round 1 is not running' });
      return;
    }

    let engine = activeEngines.get(tId);
    if (!engine) engine = getOrCreateRunnerEngine(io, tId, sessionId);
    if (!engine) return;
    engine.startGame();
  });

  socket.on('runner:player_input', ({ teamId, sessionId, action, direction, playerId }) => {
    const tId = teamId || socket.data.runnerTeamId;
    const pId = playerId || socket.data.runnerPlayerId;
    if (!tId || !pId) return;

    if (!isRound1Running()) {
      socket.emit('runner:input_rejected', { reason: 'Round 1 is not running' });
      return;
    }

    let engine = activeEngines.get(tId);
    if (!engine) engine = getOrCreateRunnerEngine(io, tId, sessionId);
    if (!engine) return;

    let resolvedAction = action;
    if (!resolvedAction && typeof direction === 'number') {
      resolvedAction = direction === -1 ? 'LEFT' : 'RIGHT';
    }

    const validation = engine.handlePlayerInput(pId, resolvedAction);
    if (validation.valid) {
      io.to(tId).emit('runner:game_tick', engine.getStatePayload());
    } else {
      socket.emit('runner:input_rejected', { reason: validation.reason });
    }
  });

  socket.on('runner:simulate_partner_connect', ({ teamId, partnerRole }) => {
    const tId = teamId || socket.data.runnerTeamId;
    if (!tId) return;
    const engine = activeEngines.get(tId);
    if (!engine) return;

    if (partnerRole === 'BOTH' || (!engine.players.P1.connected || !engine.players.P2.connected)) {
      if (!engine.players.P1.connected) engine.setPlayerConnected('P1', `sim-P1-${Date.now()}`);
      if (!engine.players.P2.connected) engine.setPlayerConnected('P2', `sim-P2-${Date.now()}`);
    } else {
      const roleToConnect = partnerRole || (socket.data.runnerPlayerId === 'P1' ? 'P2' : 'P1');
      engine.setPlayerConnected(roleToConnect, `sim-${roleToConnect}-${Date.now()}`);
    }

    io.to(tId).emit('runner:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
    });
    io.to(tId).emit('runner:game_tick', engine.getStatePayload());
  });

  socket.on('runner:admin_action', ({ teamId, action }) => {
    const tId = teamId || socket.data.runnerTeamId;
    if (!tId) return;
    const engine = activeEngines.get(tId);
    if (!engine) return;
    engine.adminAction(action);
  });

  socket.on('disconnect', () => {
    const tId = socket.data.runnerTeamId;
    const pId = socket.data.runnerPlayerId;
    if (tId && pId) {
      const engine = activeEngines.get(tId);
      if (engine) {
        engine.setPlayerDisconnected(pId);
        io.to(tId).emit('runner:room_status', {
          p1Connected: engine.players.P1.connected,
          p2Connected: engine.players.P2.connected,
          status: engine.status,
        });
      }
    }
  });
}
