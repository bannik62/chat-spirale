import { Server } from 'socket.io';
import { resolveAccessToken } from '../middleware/tokenAuth.js';
import { prisma } from '../utils/prisma.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const result = await resolveAccessToken(token);
    if (!result?.accessToken) {
      return next(new Error('Authentication error'));
    }
    if (result.error) {
      return next(new Error(result.error));
    }
    if (!result.accessToken.displayName) {
      return next(new Error('Display name not set'));
    }

    socket.accessToken = result.accessToken;
    socket.userName = result.accessToken.displayName;
    socket.userEmail = result.accessToken.email;
    socket.chatRoomId = result.accessToken.chatRoomId;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(socket.chatRoomId);

    socket.to(socket.chatRoomId).emit('system-message', {
      type: 'user-joined',
      content: `${socket.userName} a rejoint le chat`,
      at: new Date().toISOString(),
    });

    socket.on('message', async (data) => {
      const content = String(data?.content || '').trim();
      if (!content || content.length > 4000) return;

      const message = await prisma.message.create({
        data: {
          content,
          senderName: socket.userName,
          senderEmail: socket.userEmail,
          chatRoomId: socket.chatRoomId,
        },
      });

      io.to(socket.chatRoomId).emit('message', {
        id: message.id,
        content: message.content,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        createdAt: message.createdAt,
      });
    });

    socket.on('disconnect', () => {
      socket.to(socket.chatRoomId).emit('system-message', {
        type: 'user-left',
        content: `${socket.userName} s'est déconnecté(e)`,
        at: new Date().toISOString(),
      });
    });
  });

  return io;
}
