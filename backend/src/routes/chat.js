import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { tokenAuth, resolveAccessToken } from '../middleware/tokenAuth.js';

const router = Router();

router.get('/session', async (req, res) => {
  const token = req.query.token;
  const result = await resolveAccessToken(token);
  if (!result?.accessToken) {
    return res.status(401).json({ error: 'Token invalide' });
  }
  if (result.error) {
    return res.status(410).json({ error: result.error === 'expired' ? 'Chat expiré' : 'Chat désactivé' });
  }

  res.cookie('chat_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
});

router.get('/profile', tokenAuth, async (req, res) => {
  const { accessToken, chatRoom } = req;
  res.json({
    email: accessToken.email,
    displayName: accessToken.displayName,
    chatRoom: { id: chatRoom.id, name: chatRoom.name },
  });
});

router.post('/set-name', tokenAuth, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Nom invalide (min. 2 caractères)' });
  }

  await prisma.accessToken.update({
    where: { id: req.accessToken.id },
    data: { displayName: displayName.trim() },
  });

  res.json({ success: true, displayName: displayName.trim() });
});

router.get('/messages', tokenAuth, async (req, res) => {
  if (!req.accessToken.displayName) {
    return res.status(403).json({ error: 'Nom requis avant accès aux messages' });
  }

  const messages = await prisma.message.findMany({
    where: { chatRoomId: req.chatRoom.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  res.json(messages);
});

export default router;
