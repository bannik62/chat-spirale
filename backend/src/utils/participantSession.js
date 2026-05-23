import jwt from 'jsonwebtoken';
import { SESSION_COOKIE } from '../middleware/participantAuth.js';
import { sessionCookieOptions } from '../middleware/security.js';

export function issueParticipantSession(res, participant) {
  const sessionToken = jwt.sign(
    { sub: participant.id, email: participant.email, role: 'participant' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  return sessionToken;
}
