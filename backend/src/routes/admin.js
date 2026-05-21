import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getNextFriday } from '../utils/getNextFriday.js';
import { sendInvitationEmail } from '../mail/sendInvitation.js';

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
      _count: { select: { tokens: true, messages: true } },
    },
  });
  res.json(chats);
});

router.post('/chats', async (req, res) => {
  const { name, emails, isPermanent } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Nom du chat requis' });
  }

  const emailList = (Array.isArray(emails) ? emails : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes('@'));

  if (emailList.length === 0) {
    return res.status(400).json({ error: 'Au moins un email valide' });
  }

  const expiresAt = isPermanent ? null : getNextFriday();
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';

  const chat = await prisma.chatRoom.create({
    data: {
      name: name.trim(),
      expiresAt,
      tokens: {
        create: emailList.map((email) => ({
          token: crypto.randomUUID(),
          email,
        })),
      },
    },
    include: { tokens: true },
  });

  let sent = 0;
  for (const t of chat.tokens) {
    const inviteUrl = `${frontendUrl}/chat?token=${t.token}`;
    const result = await sendInvitationEmail({
      to: t.email,
      chatName: chat.name,
      inviteUrl,
    });
    if (result.sent) sent += 1;
  }

  res.status(201).json({
    chatId: chat.id,
    invitationsSent: sent,
    invitationsTotal: chat.tokens.length,
    expiresAt: chat.expiresAt,
  });
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

router.post('/chats/:id/tokens', async (req, res) => {
  const { emails } = req.body;
  const emailList = (Array.isArray(emails) ? emails : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes('@'));

  const chat = await prisma.chatRoom.findUnique({
    where: { id: req.params.id },
  });
  if (!chat) return res.status(404).json({ error: 'Chat introuvable' });

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
  const created = [];

  for (const email of emailList) {
    const token = crypto.randomUUID();
    const row = await prisma.accessToken.upsert({
      where: { email_chatRoomId: { email, chatRoomId: chat.id } },
      create: { token, email, chatRoomId: chat.id },
      update: { token, isRevoked: false },
    });
    const inviteUrl = `${frontendUrl}/chat?token=${row.token}`;
    await sendInvitationEmail({ to: email, chatName: chat.name, inviteUrl });
    created.push(row);
  }

  res.json({ tokens: created.length });
});

router.delete('/tokens/:id', async (req, res) => {
  await prisma.accessToken.update({
    where: { id: req.params.id },
    data: { isRevoked: true },
  });
  res.json({ ok: true });
});

router.get('/chats/:id/messages', async (req, res) => {
  const messages = await prisma.message.findMany({
    where: { chatRoomId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

export default router;
