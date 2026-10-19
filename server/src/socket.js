import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { registerMazeHandlers } from './games/mazeSocket.js';
import { registerRunnerHandlers } from './games/runnerSocket.js';
import { registerInvestigationHandlers } from './games/investigationSocket.js';

export function setupSocketIO(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    registerMazeHandlers(io, socket);
    registerRunnerHandlers(io, socket);
    registerInvestigationHandlers(io, socket);
  });

  return io;
}
