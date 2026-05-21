import { prisma } from '../utils/prisma.js';

export async function resolveAccessToken(rawToken) {
  if (!rawToken) return null;

  const accessToken = await prisma.accessToken.findUnique({
    where: { token: rawToken },
    include: { chatRoom: true },
  });

  if (!accessToken || accessToken.isRevoked) return null;
  if (!accessToken.chatRoom.isActive) return { error: 'disabled', accessToken };

  if (accessToken.chatRoom.expiresAt && accessToken.chatRoom.expiresAt < new Date()) {
    return { error: 'expired', accessToken };
  }

  await prisma.accessToken.update({
    where: { id: accessToken.id },
    data: { lastUsedAt: new Date() },
  });

  return { accessToken };
}

export async function tokenAuth(req, res, next) {
  const token =
    req.query.token ||
    req.headers['x-chat-token'] ||
    req.cookies?.chat_token;

  const result = await resolveAccessToken(token);
  if (!result) {
    return res.status(401).json({ error: 'Token requis ou invalide' });
  }
  if (result.error === 'disabled') {
    return res.status(410).json({ error: 'Chat désactivé' });
  }
  if (result.error === 'expired') {
    return res.status(410).json({ error: 'Chat expiré' });
  }

  req.accessToken = result.accessToken;
  req.chatRoom = result.accessToken.chatRoom;
  next();
}
