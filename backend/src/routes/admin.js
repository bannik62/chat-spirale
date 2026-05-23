import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getNextFriday } from '../utils/getNextFriday.js';
import { generateUniqueAccessCode } from '../utils/accessCode.js';
import { sendInvitationEmail } from '../mail/sendInvitation.js';
import { issueParticipantSession } from '../utils/participantSession.js';
import { addParticipantToRooms } from '../utils/addParticipantAccess.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, email: admin.email });
});

router.use(adminAuth);

router.get('/chats', async (_req, res) => {
  const chats = await prisma.chatRoom.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { memberships: true, messages: true } },
    },
  });
  res.json(chats);
});

router.post('/chats', async (req, res) => {
  const { name, isPermanent } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nom du salon requis' });
  }

  const expiresAt = isPermanent ? null : getNextFriday();
  const chat = await prisma.chatRoom.create({
    data: { name: name.trim(), expiresAt },
  });

  res.status(201).json(chat);
});

router.patch('/chats/:id', async (req, res) => {
  const { isPermanent, isActive, extend } = req.body;
  const data = {};

  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (isPermanent === true) data.expiresAt = null;
  if (extend === true) data.expiresAt = getNextFriday();

  const chat = await prisma.chatRoom.update({
    where: { id: req.params.id },
    data,
  });
  res.json(chat);
});

router.delete('/chats/:id', async (req, res) => {
  await prisma.chatRoom.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/participants', async (_req, res) => {
  const participants = await prisma.participant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: {
        include: { chatRoom: { select: { id: true, name: true } } },
      },
    },
  });

  res.json(
    participants.map((p) => ({
      id: p.id,
      email: p.email,
      accessCode: p.accessCode,
      isRevoked: p.isRevoked,
      chatRoomIds: p.memberships.map((m) => m.chatRoomId),
      rooms: p.memberships.map((m) => ({
        id: m.chatRoom.id,
        name: m.chatRoom.name,
        displayName: m.displayName,
      })),
    }))
  );
});

router.post('/participants', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const chatRoomIds = Array.isArray(req.body?.chatRoomIds) ? req.body.chatRoomIds : [];
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';

  if (!email.includes('@') || chatRoomIds.length === 0) {
    return res.status(400).json({ error: 'Email et au moins un salon requis' });
  }

  const isNew = !(await prisma.participant.findUnique({ where: { email } }));
  const sendEmailForce = isNew
    ? req.body?.sendEmail !== false
    : req.body?.sendEmail === true;

  const result = await addParticipantToRooms(email, chatRoomIds, {
    sendEmailIfNew: true,
    sendEmailForce,
  });

  if (mode === 'replace') {
    await prisma.roomMembership.deleteMany({
      where: {
        participantId: result.participant.id,
        chatRoomId: { notIn: chatRoomIds },
      },
    });
  }

  const memberships = await prisma.roomMembership.findMany({
    where: { participantId: result.participant.id },
    select: { chatRoomId: true },
  });

  res.status(isNew ? 201 : 200).json({
    id: result.participant.id,
    email: result.participant.email,
    accessCode: result.accessCode,
    chatRoomIds: memberships.map((m) => m.chatRoomId),
    addedRoomIds: result.addedRoomIds,
    merged: !isNew,
    mail: result.mail,
  });
});

/** Depuis un salon : ajouter des personnes à CE chat (accès mis à jour, code inchangé). */
router.post('/chats/:id/add-participants', async (req, res) => {
  const chat = await prisma.chatRoom.findUnique({ where: { id: req.params.id } });
  if (!chat) return res.status(404).json({ error: 'Salon introuvable' });

  const raw = Array.isArray(req.body?.emails) ? req.body.emails : [];
  const emails = [
    ...new Set(
      raw.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@'))
    ),
  ];

  if (emails.length === 0) {
    return res.status(400).json({ error: 'Au moins un email valide' });
  }

  const sendEmailForNew = req.body?.sendEmailForNew !== false;
  const results = [];

  for (const email of emails) {
    const r = await addParticipantToRooms(email, [chat.id], {
      sendEmailIfNew: sendEmailForNew,
      sendEmailForce: false,
    });
    results.push({
      email,
      accessCode: r.accessCode,
      isNew: r.isNew,
      alreadyInRoom: r.addedRoomIds.length === 0,
      mail: r.mail,
    });
  }

  res.json({
    chatId: chat.id,
    chatName: chat.name,
    results,
  });
});

router.get('/chats/:id/members', async (req, res) => {
  const memberships = await prisma.roomMembership.findMany({
    where: { chatRoomId: req.params.id },
    include: { participant: true },
    orderBy: { createdAt: 'asc' },
  });

  res.json(
    memberships.map((m) => ({
      id: m.id,
      email: m.participant.email,
      displayName: m.displayName,
      accessCode: m.participant.accessCode,
      isRevoked: m.participant.isRevoked,
    }))
  );
});

/** Remplace la liste complète des salons autorisés pour une personne. */
router.patch('/participants/:id', async (req, res) => {
  const chatRoomIds = Array.isArray(req.body?.chatRoomIds) ? req.body.chatRoomIds : [];
  if (chatRoomIds.length === 0) {
    return res.status(400).json({ error: 'Au moins un salon requis' });
  }

  const participant = await prisma.participant.findUnique({
    where: { id: req.params.id },
  });
  if (!participant) return res.status(404).json({ error: 'Personne introuvable' });

  for (const chatRoomId of chatRoomIds) {
    await prisma.roomMembership.upsert({
      where: {
        participantId_chatRoomId: {
          participantId: participant.id,
          chatRoomId,
        },
      },
      create: { participantId: participant.id, chatRoomId },
      update: {},
    });
  }

  await prisma.roomMembership.deleteMany({
    where: {
      participantId: participant.id,
      chatRoomId: { notIn: chatRoomIds },
    },
  });

  res.json({ ok: true, chatRoomIds });
});

router.post('/participants/:id/regenerate-code', async (req, res) => {
  const accessCode = await generateUniqueAccessCode();
  const participant = await prisma.participant.update({
    where: { id: req.params.id },
    data: { accessCode },
  });
  res.json({ accessCode: participant.accessCode });
});

router.post('/participants/:id/send-invite', async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { id: req.params.id },
  });
  if (!participant) return res.status(404).json({ error: 'Personne introuvable' });

  const mailResult = await sendInvitationEmail({
    to: participant.email,
    accessCode: participant.accessCode,
  });
  res.json(mailResult);
});

router.delete('/participants/:id', async (req, res) => {
  await prisma.participant.update({
    where: { id: req.params.id },
    data: { isRevoked: true },
  });
  res.json({ ok: true });
});

router.post('/chats/:id/join', async (req, res) => {
  const chat = await prisma.chatRoom.findUnique({ where: { id: req.params.id } });
  if (!chat) return res.status(404).json({ error: 'Salon introuvable' });
  if (!chat.isActive) return res.status(410).json({ error: 'Salon désactivé' });
  if (chat.expiresAt && chat.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Salon expiré' });
  }

  const adminEmail = req.admin.email.toLowerCase();
  const defaultName = (req.body?.displayName || 'Formateur').trim().slice(0, 64);
  const displayName = defaultName.length >= 2 ? defaultName : 'Formateur';

  let participant = await prisma.participant.findUnique({ where: { email: adminEmail } });
  if (!participant) {
    const accessCode = await generateUniqueAccessCode();
    participant = await prisma.participant.create({
      data: { email: adminEmail, accessCode },
    });
  }

  await prisma.roomMembership.upsert({
    where: {
      participantId_chatRoomId: {
        participantId: participant.id,
        chatRoomId: chat.id,
      },
    },
    create: {
      participantId: participant.id,
      chatRoomId: chat.id,
      displayName,
    },
    update: { displayName },
  });

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:8081';

  // Session participant (cookie) : le formateur entre dans le salon sans email+code
  issueParticipantSession(res, participant);

  res.json({
    roomId: chat.id,
    roomUrl: `${frontendUrl}/salon/${chat.id}`,
    email: adminEmail,
    displayName,
  });
});

router.get('/chats/:id/messages', async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { chatRoomId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

export default router;
