import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function getSocketConnection() {
  return io(API_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 1000,
  });
}

// ---------------- MAZE SOCKET CLIENT ----------------
export function createMazeSocketClient({
  teamId,
  playerId,
  sessionId = `maze_${teamId}`,
  mazeId = null,
  onTick,
  onRoomStatus,
  onGameOver,
  onRejected,
  onError,
}) {
  const socket = getSocketConnection();

  socket.on('connect', () => {
    socket.emit('maze:join_room', { teamId, sessionId, playerId, mazeId });
  });

  if (onTick) socket.on('maze:game_tick', onTick);
  if (onRoomStatus) socket.on('maze:room_status', onRoomStatus);
  if (onGameOver) socket.on('maze:game_over', onGameOver);
  if (onRejected) socket.on('maze:input_rejected', onRejected);
  if (onError) socket.on('maze:error_message', onError);

  return {
    socket,
    sendInput(role, axis, dir) {
      socket.emit('maze:player_input', { teamId, sessionId, playerId: role || playerId, axis, dir });
    },
    sendAdminAction(sId, action) {
      socket.emit('maze:admin_action', { teamId, sessionId: sId || sessionId, action });
    },
    simulatePartnerConnect(sId, tId, partnerRole = 'BOTH') {
      socket.emit('maze:simulate_partner_connect', { teamId: tId || teamId, sessionId: sId || sessionId, partnerRole });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

// ---------------- RUNNER SOCKET CLIENT ----------------
export function createRunnerSocketClient({
  teamId,
  playerId,
  sessionId = `runner_${teamId}`,
  onTick,
  onRoomStatus,
  onGameOver,
  onRejected,
  onError,
}) {
  const socket = getSocketConnection();

  socket.on('connect', () => {
    socket.emit('runner:join_room', { teamId, sessionId, playerId, isRefresh: true });
  });

  if (onTick) socket.on('runner:game_tick', onTick);
  if (onRoomStatus) socket.on('runner:room_status', onRoomStatus);
  if (onGameOver) socket.on('runner:game_over', onGameOver);
  if (onRejected) socket.on('runner:input_rejected', onRejected);
  if (onError) socket.on('runner:error_message', onError);

  return {
    socket,
    sendInput(action, pId) {
      socket.emit('runner:player_input', { teamId, sessionId, playerId: pId || playerId, action });
    },
    playGame(sId) {
      socket.emit('runner:play_game', { teamId, sessionId: sId || sessionId });
    },
    resetGame(sId) {
      socket.emit('runner:reset_game', { teamId, sessionId: sId || sessionId });
    },
    restartGame(sId) {
      socket.emit('runner:restart_game', { teamId, sessionId: sId || sessionId });
    },
    simulatePartnerConnect(sId, partnerRole = 'BOTH') {
      socket.emit('runner:simulate_partner_connect', { teamId, sessionId: sId || sessionId, partnerRole });
    },
    sendAdminAction(sId, action) {
      socket.emit('runner:admin_action', { teamId, sessionId: sId || sessionId, action });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

// ---------------- INVESTIGATION SOCKET CLIENT ----------------
export function createInvestigationSocketClient({
  teamId,
  playerId,
  sessionId = `r3_${teamId}`,
  devMode = false,
  onTick,
  onRoomStatus,
  onActionFeedback,
  onHintResponse,
  onVerdictResponse,
  onGameOver,
  onError,
}) {
  const socket = getSocketConnection();

  socket.on('connect', () => {
    socket.emit('round3:join_room', { teamId, sessionId, playerId, devMode });
  });

  if (onTick) socket.on('round3:game_tick', onTick);
  if (onRoomStatus) socket.on('round3:room_status', onRoomStatus);
  if (onActionFeedback) socket.on('round3:action_feedback', onActionFeedback);
  if (onHintResponse) socket.on('round3:hint_response', onHintResponse);
  if (onVerdictResponse) socket.on('round3:verdict_response', onVerdictResponse);
  if (onGameOver) socket.on('round3:game_over', onGameOver);
  if (onError) socket.on('round3:error_message', onError);

  return {
    socket,
    connectEvidence(sourceCardId, targetCardId) {
      socket.emit('round3:connect_evidence', { teamId, sessionId, sourceCardId, targetCardId });
    },
    submitClue(stageId, answer) {
      socket.emit('round3:submit_clue', { teamId, sessionId, stageId, answer });
    },
    requestHint(stageId) {
      socket.emit('round3:request_hint', { teamId, sessionId, stageId });
    },
    submitVerdict(verdict, finalToken) {
      socket.emit('round3:submit_verdict', { teamId, sessionId, verdict, finalToken });
    },
    simulatePartnerConnect(partnerRole = 'BOTH') {
      socket.emit('round3:simulate_partner_connect', { teamId, partnerRole });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
