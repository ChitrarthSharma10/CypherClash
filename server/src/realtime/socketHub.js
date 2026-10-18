import { Server } from 'socket.io';
import { z } from 'zod';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { config } from '../config.js';
import { sessionMiddleware } from '../sessionMiddleware.js';
import {
  getRoundState,
  getRunningRound,
  listRoundStates,
  onRoundStateChange,
} from '../services/roundState.js';
import { submitGameResult } from '../services/scoring.js';
import { gameModule as circuitSync } from '../games/circuitSync.js';
import { recordPlayerPresence, setPlayerConnected } from '../services/presence.js';
import { getLeaderboard, setLeaderboardSocketServer } from '../services/leaderboard.js';

const TEAM_ID_SCHEMA = z.string().regex(/^CC-\d{3,}$/);
const seatSockets = new Map();
const teamGames = new Map();
const gameModules = new Map([['circuit', circuitSync]]);
let io;
let roundClock;

function seatKey(teamId, slot) {
  return `${teamId}:${slot}`;
}

function connectedSeats(teamId) {
  return ['P1', 'P2'].every((slot) => seatSockets.has(seatKey(teamId, slot)));
}

function emitPresence(teamId) {
  for (const slot of ['P1', 'P2']) {
    const socket = seatSockets.get(seatKey(teamId, slot));
    if (socket) {
      socket.emit('cs:presence', { teammateConnected: Boolean(seatSockets.get(seatKey(teamId, slot === 'P1' ? 'P2' : 'P1'))) });
    }
  }
}

function getCurrentRound() {
  const runningRound = getRunningRound();
  if (runningRound) return runningRound;
  const rounds = listRoundStates();
  return rounds.find((round) => round.status === 'running')
    || rounds.filter((round) => round.status === 'paused').at(-1)
    || rounds.at(-1)
    || null;
}

function emitRoundClock(teamId) {
  const round = getCurrentRound();
  const now = Date.now();
  const remainingMs = round?.deadline
    ? Math.max(0, round.deadline.getTime() - (round.status === 'paused' && round.pausedAt ? round.pausedAt.getTime() : now))
    : null;
  io.to(`team:${teamId}`).emit('cs:round', {
    status: round?.status || 'not_started',
    round: round?.round ?? null,
    remainingMs,
  });
}

function emitRoundClocks() {
  if (!io) return;
  const teams = new Set([...seatSockets.values()].map((socket) => socket.data.teamId));
  for (const teamId of teams) emitRoundClock(teamId);
}

function sendTeamViews(teamId) {
  const runtime = teamGames.get(teamId);
  if (!runtime) return;
  for (const slot of ['P1', 'P2']) {
    const socket = seatSockets.get(seatKey(teamId, slot));
    if (socket) socket.emit('cs:state', runtime.module.view(runtime.game, slot));
  }
}

function maybeStartGame(teamId) {
  const existing = teamGames.get(teamId);
  const runningRound = getRunningRound();
  if (existing && (!runningRound || existing.round === runningRound.round)) {
    sendTeamViews(teamId);
    return;
  }
  if (!runningRound || runningRound.deadline.getTime() <= Date.now() || !connectedSeats(teamId)) return;
  const module = gameModules.get('circuit');
  if (!module) {
    console.error('Circuit Sync game module is not registered');
    return;
  }
  teamGames.set(teamId, {
    game: module.createGame(),
    module,
    gameName: 'circuit',
    round: runningRound.round,
    finishSubmitted: false,
  });
  sendTeamViews(teamId);
}

async function handleGameEvent(socket, eventName, args, eventHandlers, timestamps) {
  const now = Date.now();
  while (timestamps.length && timestamps[0] <= now - 1000) timestamps.shift();
  if (timestamps.length >= 10) {
    console.warn('Rate-limited realtime event', {
      eventName,
      teamId: socket.data.teamId,
      slot: socket.data.slot,
    });
    return;
  }
  timestamps.push(now);

  const handler = eventHandlers.get(eventName);
  if (!handler) {
    console.warn('Ignored unknown realtime event', {
      eventName,
      teamId: socket.data.teamId,
      slot: socket.data.slot,
    });
    return;
  }
  if (args.length !== 1) {
    console.warn('Ignored invalid realtime event payload', {
      eventName,
      teamId: socket.data.teamId,
      slot: socket.data.slot,
    });
    return;
  }
  const parsed = handler.schema.safeParse(args[0]);
  if (!parsed.success) {
    console.warn('Ignored invalid realtime event payload', {
      eventName,
      teamId: socket.data.teamId,
      slot: socket.data.slot,
    });
    return;
  }

  const runtime = teamGames.get(socket.data.teamId);
  const round = runtime && getRoundState(runtime.round);
  if (!runtime || round?.status !== 'running' || round.deadline?.getTime() <= Date.now()) return;
  try {
    const outcome = handler.handle(runtime.game, socket.data.slot, parsed.data);
    if (!outcome?.changed) return;
    if (outcome.reset) {
      io.to(`team:${socket.data.teamId}`).emit('cs:message', {
        type: 'error',
        text: 'Stage limit reached. A new circuit has been generated.',
      });
    }
    sendTeamViews(socket.data.teamId);
    if (outcome.finished && !runtime.finishSubmitted) {
      runtime.finishSubmitted = true;
      try {
        await submitGameResult(socket.data.teamId, runtime.gameName, outcome.points);
      } catch (error) {
        console.error('Failed to save completed game result', {
          teamId: socket.data.teamId,
          round: runtime.round,
          code: error.code || 'unknown error',
        });
      }
    }
  } catch (error) {
    console.error('Realtime game event failed', {
      eventName,
      teamId: socket.data.teamId,
      code: error.code || 'unknown error',
    });
  }
}

export function attachSocketIo(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.frontendOrigin,
      credentials: true,
    },
    maxHttpBufferSize: 10 * 1024,
  });
  io.engine.use((request, response, next) => {
    if (request.headers.origin !== config.frontendOrigin) {
      return next(new Error('Origin not allowed'));
    }
    return next();
  });
  io.engine.use(sessionMiddleware);
  setLeaderboardSocketServer(io);

  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;
      if (session?.role !== 'player'
        || !session.playerId
        || !session.teamId
        || !['P1', 'P2'].includes(session.slot)
        || !TEAM_ID_SCHEMA.safeParse(session.teamId).success) {
        return next(new Error('Authentication required'));
      }
      const [player, team] = await Promise.all([
        Player.findOne({
          _id: session.playerId,
          teamId: session.teamId,
          slot: session.slot,
        }).select('_id teamId slot'),
        Team.findOne({ teamId: session.teamId, active: true }).select('teamId active'),
      ]);
      if (!player || !team) return next(new Error('Authentication required'));
      socket.data.teamId = team.teamId;
      socket.data.slot = player.slot;
      socket.data.playerId = player._id.toString();
      return next();
    } catch (error) {
      return next(error);
    }
  });

  io.on('connection', (socket) => {
    const { teamId, slot } = socket.data;
    recordPlayerPresence(teamId, slot);
    const key = seatKey(teamId, slot);
    const previous = seatSockets.get(key);
    seatSockets.set(key, socket);
    setPlayerConnected(teamId, slot, true);
    if (previous) previous.disconnect(true);
    socket.join(`team:${teamId}`);
    socket.join('leaderboard');
    emitPresence(teamId);
    emitRoundClock(teamId);
    getLeaderboard(teamId)
      .then((board) => {
        if (socket.connected) socket.emit('lb:update', board);
      })
      .catch((error) => {
        console.error('Failed to send initial leaderboard', error);
      });

    const eventHandlers = new Map(Object.entries(circuitSync.events));
    const eventTimestamps = [];
    socket.onAny((eventName, ...args) => {
      void handleGameEvent(socket, eventName, args, eventHandlers, eventTimestamps);
    });

    maybeStartGame(teamId);
    socket.on('disconnect', () => {
      if (seatSockets.get(key) === socket) {
        seatSockets.delete(key);
        setPlayerConnected(teamId, slot, false);
      }
      emitPresence(teamId);
    });
  });

  onRoundStateChange((roundState) => {
    emitRoundClocks();
    if (roundState.status !== 'running') return;
    const teams = new Set([...seatSockets.values()].map((socket) => socket.data.teamId));
    for (const teamId of teams) maybeStartGame(teamId);
  });

  if (roundClock) clearInterval(roundClock);
  roundClock = setInterval(emitRoundClocks, 1000);
  roundClock.unref?.();

  return io;
}

export function disconnectTeamSockets(teamId) {
  if (!io || !TEAM_ID_SCHEMA.safeParse(teamId).success) return;
  teamGames.delete(teamId);
  for (const slot of ['P1', 'P2']) {
    const key = seatKey(teamId, slot);
    const socket = seatSockets.get(key);
    seatSockets.delete(key);
    setPlayerConnected(teamId, slot, false);
    socket?.disconnect(true);
  }
  io.in(`team:${teamId}`).disconnectSockets(true);
}

export function getTeamGameRuntime(teamId) {
  return teamGames.get(teamId);
}
