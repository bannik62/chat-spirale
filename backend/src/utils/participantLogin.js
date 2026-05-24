import { prisma } from './prisma.js';
import { normalizeAccessCode } from './accessCode.js';
import { roomsForParticipant } from './roomsForParticipant.js';

export async function verifyParticipantCredentials(email, code) {
  const normalized = String(email || '').trim().toLowerCase();
  const accessCode = normalizeAccessCode(code);

  if (!normalized.includes('@') || accessCode.length < 7) {
    return { error: 'Email ou code invalide' };
  }

  const participant = await prisma.participant.findFirst({
    where: { email: normalized, accessCode, isRevoked: false },
  });

  if (!participant) {
    return { error: 'Email ou code incorrect' };
  }

  const rooms = await roomsForParticipant(participant.id);
  if (rooms.length === 0) {
    return { error: 'Aucune activité accessible pour le moment' };
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: { lastLoginAt: new Date() },
  });

  return { participant, rooms };
}

export function participantRedirect(rooms) {
  if (rooms.length === 0) return '/';
  return '/mes-activites';
}
