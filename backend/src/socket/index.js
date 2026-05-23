import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { prisma } from '../utils/prisma.js';
import { SESSION_COOKIE } from '../middleware/participantAuth.js';
import { getAllowedOrigins } from '../middleware/security.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const allowed = getAllowedOrigins();
        if (allowed.includes(origin.replace(/\/$/, ''))) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS Socket.IO refusé'));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const roomId = socket.handshake.auth?.roomId;
      if (!roomId) return next(new Error('roomId required'));

      let sessionToken = socket.handshake.auth?.sessionToken;
      if (!sessionToken && socket.handshake.headers.cookie) {
        const parsed = cookie.parse(socket.handshake.headers.cookie);
        sessionToken = parsed[SESSION_COOKIE];
      }

      if (!sessionToken) return next(new Error('Authentication error'));

      const payload = jwt.verify(sessionToken, process.env.JWT_SECRET);
      if (payload.role !== 'participant') return next(new Error('Authentication error'));

      const membership = await prisma.roomMembership.findUnique({
        where: {
          participantId_chatRoomId: {
            participantId: payload.sub,
            chatRoomId: roomId,
          },
        },
        include: { chatRoom: true },
      });

      if (!membership?.displayName) {
        return next(new Error('Display name not set'));
      }

      const room = membership.chatRoom;
      if (!room.isActive) return next(new Error('disabled'));
      if (room.expiresAt && room.expiresAt < new Date()) {
        return next(new Error('expired'));
      }

      socket.userName = membership.displayName;
      socket.userEmail = payload.email;
      socket.chatRoomId = roomId;
      socket.participantId = payload.sub;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
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
