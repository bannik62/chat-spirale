import { prisma } from './prisma.js';
import { activeRoomWhere, generateUniqueAccessCode } from './accessCode.js';

export function getFormateurEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;
}

/** @param {string | null | undefined} email */
export function isFormateurEmail(email) {
  const admin = getFormateurEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

/**
 * Compte participant technique pour le chat + accès à tous les salons actifs.
 * Invisible dans la liste « Personnes » (filtré côté API).
 */
export async function syncFormateurAllRooms(adminEmail) {
  const email = adminEmail.trim().toLowerCase();
  const defaultName = 'Formateur';

  let participant = await prisma.participant.findUnique({ where: { email } });
  if (!participant) {
    const accessCode = await generateUniqueAccessCode();
    participant = await prisma.participant.create({
      data: { email, accessCode, displayName: defaultName },
    });
  } else if (participant.isRevoked) {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: { isRevoked: false },
    });
  }

  const displayName = participant.displayName || defaultName;
  if (!participant.displayName) {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: { displayName },
    });
  }

  const rooms = await prisma.chatRoom.findMany({
    where: activeRoomWhere(),
    select: { id: true },
  });

  for (const room of rooms) {
    await prisma.roomMembership.upsert({
      where: {
        participantId_chatRoomId: {
          participantId: participant.id,
          chatRoomId: room.id,
        },
      },
      create: {
        participantId: participant.id,
        chatRoomId: room.id,
        displayName,
      },
      update: { displayName },
    });
  }

  return participant;
}

/** @param {{ email: string } | null | undefined} participant */
export function isFormateurParticipant(participant) {
  return participant && isFormateurEmail(participant.email);
}
