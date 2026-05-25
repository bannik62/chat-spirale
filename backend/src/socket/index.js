import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { prisma } from '../utils/prisma.js';
import { SESSION_COOKIE } from '../middleware/participantAuth.js';
import { getAllowedOrigins } from '../middleware/security.js';
import {
  joinRoom,
  leaveRoom,
  setTyping,
  setLastRead,
  roomSnapshot,
} from './roomPresence.js';

function emitRoomState(io, roomId) {
  io.to(roomId).emit('room-state', roomSnapshot(roomId));
}

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
        include: { chatRoom: true, participant: true },
      });

      if (!membership?.displayName && !membership?.participant?.displayName) {
        return next(new Error('Display name not set'));
      }

      const room = membership.chatRoom;
      if (!room.isActive) return next(new Error('disabled'));
      if (room.expiresAt && room.expiresAt < new Date()) {
        return next(new Error('expired'));
      }

      const displayName =
        membership.participant.displayName ?? membership.displayName;

      socket.userName = displayName;
      socket.userEmail = payload.email;
      socket.chatRoomId = roomId;
      socket.participantId = payload.sub;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { chatRoomId, participantId, userName, userEmail } = socket;

    joinRoom(chatRoomId, participantId, { userName, userEmail });
    socket.join(chatRoomId);
    emitRoomState(io, chatRoomId);

    socket.to(chatRoomId).emit('system-message', {
      type: 'user-joined',
      content: `${userName} a rejoint le chat`,
      at: new Date().toISOString(),
    });

    socket.on('typing', (data) => {
      setTyping(chatRoomId, participantId, !!data?.typing);
      emitRoomState(io, chatRoomId);
    });

    socket.on('mark-read', (data) => {
      const readAt = data?.readAt ? new Date(data.readAt) : new Date();
      if (Number.isNaN(readAt.getTime())) return;
      setLastRead(chatRoomId, participantId, readAt);
      socket.to(chatRoomId).emit('read-update', {
        participantId,
        userName,
        email: userEmail,
        readAt: readAt.toISOString(),
      });
      socket.emit('read-update', {
        participantId,
        userName,
        email: userEmail,
        readAt: readAt.toISOString(),
      });
    });

    socket.on('message', async (data) => {
      setTyping(chatRoomId, participantId, false);

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

      io.to(chatRoomId).emit('message', {
        id: message.id,
        content: message.content,
        senderName: message.senderName,
        senderEmail: message.senderEmail,
        createdAt: message.createdAt,
      });
      emitRoomState(io, chatRoomId);
    });

    socket.on('disconnect', () => {
      leaveRoom(chatRoomId, participantId);
      emitRoomState(io, chatRoomId);

      socket.to(chatRoomId).emit('system-message', {
        type: 'user-left',
        content: `${userName} s'est déconnecté(e)`,
        at: new Date().toISOString(),
      });
    });
  });

  return io;
}
