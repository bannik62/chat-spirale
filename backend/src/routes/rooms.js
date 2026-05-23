import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { participantAuth, loadMembership } from '../middleware/participantAuth.js';

const router = Router();

router.use(participantAuth);

router.get('/:roomId/profile', loadMembership, async (req, res) => {
  res.json({
    email: req.participant.email,
    displayName: req.membership.displayName,
    chatRoom: { id: req.chatRoom.id, name: req.chatRoom.name },
  });
});

router.post('/:roomId/set-name', loadMembership, async (req, res) => {
  const { displayName } = req.body;
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Nom invalide (min. 2 caractères)' });
  }

  const name = displayName.trim();
  await prisma.roomMembership.update({
    where: { id: req.membership.id },
    data: { displayName: name },
  });

  res.json({ success: true, displayName: name });
});

router.get('/:roomId/messages', loadMembership, async (req, res) => {
  if (!req.membership.displayName) {
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
