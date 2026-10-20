import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { registerMazeHandlers, setupMazeRoundListener } from './games/mazeSocket.js';
import { registerRunnerHandlers, setupRunnerRoundListener } from './games/runnerSocket.js';
import { onRoundStateChange } from './services/roundState.js';

export function setupSocketIO(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.frontendOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  onRoundStateChange((state) => {
    io.emit('round:update', state);
  });

  setupMazeRoundListener(io);
  setupRunnerRoundListener(io);

  io.on('connection', (socket) => {
    registerMazeHandlers(io, socket);
    registerRunnerHandlers(io, socket);
  });

  return io;
}

