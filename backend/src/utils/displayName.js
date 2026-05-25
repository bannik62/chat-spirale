import { prisma } from './prisma.js';

export function normalizeDisplayName(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

export function isValidDisplayName(raw) {
  return normalizeDisplayName(raw).length >= 2;
}

/** @param {string | null | undefined} participantName */
/** @param {string | null | undefined} membershipName */
export function effectiveDisplayName(participantName, membershipName) {
  return participantName ?? membershipName ?? null;
}

export async function setParticipantDisplayName(participantId, rawName) {
  const displayName = normalizeDisplayName(rawName);
  if (displayName.length < 2) {
    throw new Error('Nom invalide');
  }

  await prisma.participant.update({
    where: { id: participantId },
    data: { displayName },
  });

  await prisma.roomMembership.updateMany({
    where: { participantId },
    data: { displayName },
  });

  return displayName;
}
