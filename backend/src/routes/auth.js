import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE, getParticipantFromCookie } from '../middleware/participantAuth.js';
import { issueParticipantSession } from '../utils/participantSession.js';
import { verifyAdminCredentials, createAdminJwt, getAdminFromRequest } from '../utils/adminLogin.js';
import { verifyParticipantCredentials } from '../utils/participantLogin.js';
import { roomsForParticipant } from '../utils/roomsForParticipant.js';
import { adminCookieOptions, sessionCookieOptions } from '../middleware/security.js';

const router = Router();

function clearAdminSession(res) {
  res.clearCookie('spirale_admin', adminCookieOptions());
}

/** Connexion unique : mode admin (mdp) ou participant (code) → redirect selon rôle */
router.post('/portal-login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const mode = req.body?.mode === 'admin' ? 'admin' : 'participant';

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  if (mode === 'admin') {
    const password = req.body?.password;
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    const admin = await verifyAdminCredentials(email, password);
    if (!admin) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = createAdminJwt(admin);
    res.cookie('spirale_admin', token, adminCookieOptions());

    return res.json({
      role: 'admin',
      email: admin.email,
      redirect: '/admin',
      token,
    });
  }

  const code = req.body?.code;
  const result = await verifyParticipantCredentials(email, code);
  if (result.error) {
    return res.status(result.error.includes('incorrect') ? 401 : 403).json({
      error: result.error,
    });
  }

  issueParticipantSession(res, result.participant);
  clearAdminSession(res);

  return res.json({
    role: 'participant',
    email: result.participant.email,
    redirect: '/mes-activites',
    rooms: result.rooms,
  });
});

/** Session active — Bearer admin explicite prioritaire, sinon cookies seuls (participant d’abord). */
router.get('/session', async (req, res) => {
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');

  if (hasBearer) {
    const admin = getAdminFromRequest(req);
    if (admin) {
      return res.json({ role: 'admin', email: admin.email, redirect: '/admin' });
    }
    return res.json({ role: null });
  }

  const participant = getParticipantFromCookie(req);
  if (participant) {
    const rooms = await roomsForParticipant(participant.id);
    if (rooms.length > 0) {
      return res.json({
        role: 'participant',
        email: participant.email,
        redirect: '/mes-activites',
        rooms,
      });
    }
  }

  const admin = getAdminFromRequest(req);
  if (admin) {
    return res.json({ role: 'admin', email: admin.email, redirect: '/admin' });
  }

  return res.json({ role: null });
});

/** Contexte chat : session participant requise, droits formateur validés côté serveur. */
router.get('/room-context', (req, res) => {
  const participant = getParticipantFromCookie(req);
  if (!participant) {
    return res.status(401).json({ error: 'Non connecté' });
  }

  const admin = getAdminFromRequest(req);
  res.json({
    email: participant.email,
    isFormateur: !!admin,
  });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const result = await verifyParticipantCredentials(email, req.body?.code);
  if (result.error) {
    return res.status(result.error.includes('incorrect') ? 401 : 403).json({
      error: result.error,
    });
  }

  issueParticipantSession(res, result.participant);
  clearAdminSession(res);
  res.json({
    role: 'participant',
    email: result.participant.email,
    rooms: result.rooms,
    redirect: '/mes-activites',
  });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Non connecté' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'participant') {
      return res.status(401).json({ error: 'Session invalide' });
    }
    const rooms = await roomsForParticipant(payload.sub);
    res.json({ email: payload.email, rooms });
  } catch {
    res.status(401).json({ error: 'Session expirée' });
  }
});

router.post('/logout', (req, res) => {
  const sessionOpts = sessionCookieOptions();
  const adminOpts = adminCookieOptions();
  res.clearCookie(SESSION_COOKIE, sessionOpts);
  res.clearCookie('spirale_admin', adminOpts);
  res.json({ ok: true });
});

export default router;
