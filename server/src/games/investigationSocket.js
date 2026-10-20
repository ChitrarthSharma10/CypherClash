import { InvestigationGameEngine } from './investigation_engine/gameEngine.js';
import { submitGameResult } from '../services/scoring.js';
import { logEvent } from '../utils/logging.js';

class MemoryInvestigationRepository {
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
  async isTeamEligible() {
    return true;
  }
}

const repository = new MemoryInvestigationRepository();
const activeEngines = new Map(); // keyed by teamId

function broadcastFilteredState(io, teamId, engine) {
  const roomSockets = io.sockets.adapter.rooms.get(teamId);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s && s.data && s.data.investigationPlayerId) {
      const filtered = engine.getFilteredState(s.data.investigationPlayerId);
      s.emit('round3:game_tick', filtered);
    }
  }
}

export function getOrCreateInvestigationEngine(io, teamId, sessionId = `r3_${teamId}`) {
  if (activeEngines.has(teamId)) {
    return activeEngines.get(teamId);
  }

  const engine = new InvestigationGameEngine(
    { sessionId, teamId },
    repository,
    () => {
      broadcastFilteredState(io, teamId, engine);
    },
    async (finalResult) => {
      io.to(teamId).emit('round3:game_over', finalResult);
      try {
        const rawScore = finalResult.score ?? 0;
        const points = Math.max(0, Math.min(1000, Math.round(rawScore)));
        await submitGameResult(teamId, 'investigation', points);
        await logEvent({
          type: 'game score submitted',
          actorType: 'system',
          actorId: 'investigation-engine',
          teamId,
          details: { game: 'investigation', round: 3, points },
        });
      } catch (err) {
        console.warn(`[Investigation] Score submission for team ${teamId}: ${err.message}`);
      }
    }
  );

  activeEngines.set(teamId, engine);
  return engine;
}

export function registerInvestigationHandlers(io, socket) {
  socket.on('round3:join_room', ({ teamId, sessionId, playerId, devMode }) => {
    if (!teamId) {
      socket.emit('round3:error_message', { message: 'teamId is required' });
      return;
    }

    const normPlayerId = (playerId === 'P2' || playerId === '2' || String(playerId).toLowerCase().includes('2')) ? 'P2' : 'P1';
    socket.data.investigationTeamId = teamId;
    socket.data.investigationPlayerId = normPlayerId;
    socket.data.isDevMode = Boolean(devMode);

    socket.join(teamId);

    const engine = getOrCreateInvestigationEngine(io, teamId, sessionId);
    engine.setPlayerConnected(normPlayerId, socket.id);

    io.to(teamId).emit('round3:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
      teamId,
      sessionId,
    });

    socket.emit('round3:game_tick', engine.getFilteredState(normPlayerId));
  });

  socket.on('round3:connect_evidence', ({ sourceCardId, targetCardId, teamId }) => {
    const tId = teamId || socket.data.investigationTeamId;
    const pId = socket.data.investigationPlayerId;
    if (!tId || !pId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    const outcome = engine.handleConnectEvidence(pId, sourceCardId, targetCardId);
    if (!outcome.success) {
      socket.emit('round3:action_feedback', { success: false, message: outcome.reason });
    } else {
      socket.emit('round3:action_feedback', { success: true, message: outcome.message });
      broadcastFilteredState(io, tId, engine);
    }
  });

  socket.on('round3:submit_clue', ({ stageId, answer, teamId }) => {
    const tId = teamId || socket.data.investigationTeamId;
    const pId = socket.data.investigationPlayerId;
    if (!tId || !pId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    const outcome = engine.handleSubmitClue(pId, stageId, answer);
    if (!outcome.success) {
      socket.emit('round3:action_feedback', {
        success: false,
        message: outcome.reason,
        attemptsRemaining: outcome.attemptsRemaining,
        cooldownApplied: outcome.cooldownApplied,
      });
    } else {
      socket.emit('round3:action_feedback', { success: true, message: outcome.message });
      broadcastFilteredState(io, tId, engine);
    }
  });

  socket.on('round3:request_hint', ({ stageId, teamId }) => {
    const tId = teamId || socket.data.investigationTeamId;
    const pId = socket.data.investigationPlayerId;
    if (!tId || !pId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    const outcome = engine.handleRequestHint(pId, stageId);
    socket.emit('round3:hint_response', outcome);
    if (outcome.success) {
      broadcastFilteredState(io, tId, engine);
    }
  });

  socket.on('round3:submit_verdict', ({ verdict, finalToken, teamId }) => {
    const tId = teamId || socket.data.investigationTeamId;
    const pId = socket.data.investigationPlayerId;
    if (!tId || !pId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    const outcome = engine.handleSubmitVerdict(pId, verdict, finalToken);
    socket.emit('round3:verdict_response', outcome);
  });

  socket.on('round3:simulate_partner_connect', ({ teamId, partnerRole }) => {
    const tId = teamId || socket.data.investigationTeamId;
    if (!tId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    if (partnerRole === 'BOTH' || (!engine.players.P1.connected || !engine.players.P2.connected)) {
      if (!engine.players.P1.connected) engine.setPlayerConnected('P1', `dev-P1-${Date.now()}`);
      if (!engine.players.P2.connected) engine.setPlayerConnected('P2', `dev-P2-${Date.now()}`);
    } else {
      const roleToConnect = partnerRole || (socket.data.investigationPlayerId === 'P1' ? 'P2' : 'P1');
      engine.setPlayerConnected(roleToConnect, `dev-${roleToConnect}-${Date.now()}`);
    }

    io.to(tId).emit('round3:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
    });
    broadcastFilteredState(io, tId, engine);
  });

  socket.on('disconnect', () => {
    const tId = socket.data.investigationTeamId;
    const pId = socket.data.investigationPlayerId;
    if (tId && pId) {
      const engine = activeEngines.get(tId);
      if (engine) {
        engine.setPlayerDisconnected(pId);
        io.to(tId).emit('round3:room_status', {
          p1Connected: engine.players.P1.connected,
          p2Connected: engine.players.P2.connected,
          status: engine.status,
        });
      }
    }
  });
}
