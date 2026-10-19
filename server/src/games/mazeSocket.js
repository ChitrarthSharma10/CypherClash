import { MazeGameEngine } from './maze_engine/gameEngine.js';
import { MAZE_LAYOUTS } from './maze_engine/config.js';
import { submitGameResult } from '../services/scoring.js';
import { logEvent } from '../utils/logging.js';

class MemorySessionRepository {
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

const repository = new MemorySessionRepository();
const activeEngines = new Map(); // keyed by teamId

export function getOrCreateMazeEngine(io, teamId, sessionId = `maze_${teamId}`, mazeId = null) {
  if (activeEngines.has(teamId)) {
    return activeEngines.get(teamId);
  }

  const engine = new MazeGameEngine(
    { sessionId, teamId, mazeId: mazeId || MAZE_LAYOUTS[0].id },
    repository,
    (state) => {
      io.to(teamId).emit('maze:game_tick', state);
    },
    async (finalResult) => {
      io.to(teamId).emit('maze:game_over', finalResult);
      try {
        const rawScore = finalResult.score ?? finalResult.standardResult?.score ?? 0;
        const points = Math.max(0, Math.min(1000, Math.round(rawScore)));
        await submitGameResult(teamId, 'maze', points);
        await logEvent({
          type: 'game score submitted',
          actorType: 'system',
          actorId: 'maze-engine',
          teamId,
          details: { game: 'maze', points },
        });
      } catch (err) {
        console.warn(`[Maze] Score submission for team ${teamId}: ${err.message}`);
      }
    }
  );

  activeEngines.set(teamId, engine);
  return engine;
}

export function registerMazeHandlers(io, socket) {
  socket.on('maze:join_room', ({ teamId, sessionId, playerId, mazeId }) => {
    if (!teamId) {
      socket.emit('maze:error_message', { message: 'teamId is required' });
      return;
    }

    const normPlayerId = (playerId === 'P2' || playerId === '2' || String(playerId).toLowerCase().includes('2')) ? 'P2' : 'P1';
    socket.data.mazeTeamId = teamId;
    socket.data.mazePlayerId = normPlayerId;

    socket.join(teamId);

    const engine = getOrCreateMazeEngine(io, teamId, sessionId, mazeId);
    engine.setPlayerConnected(normPlayerId, socket.id);

    io.to(teamId).emit('maze:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
      participants: {
        P1: { connected: engine.players.P1.connected, role: 'VERTICAL_CONTROLS' },
        P2: { connected: engine.players.P2.connected, role: 'HORIZONTAL_CONTROLS' },
      },
    });

    socket.emit('maze:game_tick', engine.getStatePayload());
  });

  socket.on('maze:player_input', ({ teamId, sessionId, playerId, axis, dir }) => {
    const tId = teamId || socket.data.mazeTeamId;
    const pId = playerId || socket.data.mazePlayerId;
    if (!tId || !pId) return;

    const engine = activeEngines.get(tId);
    if (!engine) return;

    const validation = engine.handlePlayerInput(pId, axis, dir);
    if (!validation.valid) {
      socket.emit('maze:input_rejected', { reason: validation.reason });
    }
  });

  socket.on('maze:simulate_partner_connect', ({ teamId, partnerRole }) => {
    const tId = teamId || socket.data.mazeTeamId;
    if (!tId) return;
    const engine = activeEngines.get(tId);
    if (!engine) return;

    if (partnerRole === 'BOTH' || (!engine.players.P1.connected || !engine.players.P2.connected)) {
      if (!engine.players.P1.connected) engine.setPlayerConnected('P1', `sim-P1-${Date.now()}`);
      if (!engine.players.P2.connected) engine.setPlayerConnected('P2', `sim-P2-${Date.now()}`);
    } else {
      const roleToConnect = partnerRole || (socket.data.mazePlayerId === 'P1' ? 'P2' : 'P1');
      engine.setPlayerConnected(roleToConnect, `sim-${roleToConnect}-${Date.now()}`);
    }

    io.to(tId).emit('maze:room_status', {
      p1Connected: engine.players.P1.connected,
      p2Connected: engine.players.P2.connected,
      status: engine.status,
    });
    io.to(tId).emit('maze:game_tick', engine.getStatePayload());
  });

  socket.on('maze:admin_action', ({ teamId, action }) => {
    const tId = teamId || socket.data.mazeTeamId;
    if (!tId) return;
    const engine = activeEngines.get(tId);
    if (!engine) return;
    engine.adminAction(action);
  });

  socket.on('disconnect', () => {
    const tId = socket.data.mazeTeamId;
    const pId = socket.data.mazePlayerId;
    if (tId && pId) {
      const engine = activeEngines.get(tId);
      if (engine) {
        engine.setPlayerDisconnected(pId);
        io.to(tId).emit('maze:room_status', {
          p1Connected: engine.players.P1.connected,
          p2Connected: engine.players.P2.connected,
          status: engine.status,
        });
      }
    }
  });
}
