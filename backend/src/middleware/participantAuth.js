import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { activeRoomWhere } from '../utils/accessCode.js';

export const SESSION_COOKIE = 'spirale_session';

export function getParticipantFromCookie(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'participant') return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function participantAuth(req, res, next) {
  const p = getParticipantFromCookie(req);
  if (!p) {
    return res.status(401).json({ error: 'Non connecté' });
  }
  req.participant = p;
  next();
}

export async function loadMembership(req, res, next) {
  const roomId = req.params.roomId;
  const membership = await prisma.roomMembership.findUnique({
    where: {
      participantId_chatRoomId: {
        participantId: req.participant.id,
        chatRoomId: roomId,
      },
    },
    include: { chatRoom: true },
  });

  if (!membership) {
    return res.status(403).json({ error: 'Accès non autorisé à ce salon' });
  }

  const room = membership.chatRoom;
  if (!room.isActive) {
    return res.status(410).json({ error: 'Salon désactivé' });
  }
  if (room.expiresAt && room.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Salon expiré' });
  }

  req.membership = membership;
  req.chatRoom = room;
  next();
}
