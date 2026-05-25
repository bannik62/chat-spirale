import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { participantAuth, loadMembership } from '../middleware/participantAuth.js';
import {
  effectiveDisplayName,
  isValidDisplayName,
  setParticipantDisplayName,
} from '../utils/displayName.js';

const router = Router();

router.use(participantAuth);

router.get('/:roomId/profile', loadMembership, async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { id: req.participant.id },
  });

  let displayName = effectiveDisplayName(participant?.displayName, req.membership.displayName);

  if (participant?.displayName && req.membership.displayName !== participant.displayName) {
    await prisma.roomMembership.update({
      where: { id: req.membership.id },
      data: { displayName: participant.displayName },
    });
    displayName = participant.displayName;
  }

  res.json({
    email: req.participant.email,
    displayName,
    chatRoom: { id: req.chatRoom.id, name: req.chatRoom.name },
  });
});

router.post('/:roomId/set-name', loadMembership, async (req, res) => {
  const { displayName } = req.body ?? {};
  if (!isValidDisplayName(displayName)) {
    return res.status(400).json({ error: 'Nom invalide (min. 2 caractères)' });
  }
  try {
    const name = await setParticipantDisplayName(req.participant.id, displayName);
    res.json({ success: true, displayName: name });
  } catch {
    return res.status(400).json({ error: 'Nom invalide (min. 2 caractères)' });
  }
});

router.get('/:roomId/messages', loadMembership, async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { id: req.participant.id },
  });
  const displayName = effectiveDisplayName(participant?.displayName, req.membership.displayName);
  if (!displayName) {
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
