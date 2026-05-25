import { prisma } from './prisma.js';
import { activeRoomWhere } from './accessCode.js';

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
 * Profil chat du formateur : accès à tous les salons actifs, sans code participant.
 */
export async function syncFormateurAllRooms(adminEmail) {
  const email = adminEmail.trim().toLowerCase();
  const defaultName = 'Formateur';

  let participant = await prisma.participant.findUnique({ where: { email } });
  if (!participant) {
    participant = await prisma.participant.create({
      data: { email, accessCode: null, displayName: defaultName },
    });
  } else {
    const updates = {};
    if (participant.isRevoked) updates.isRevoked = false;
    if (participant.accessCode != null) updates.accessCode = null;
    if (!participant.displayName) updates.displayName = defaultName;
    if (Object.keys(updates).length > 0) {
      participant = await prisma.participant.update({
        where: { id: participant.id },
        data: updates,
      });
    }
  }

  const displayName = participant.displayName || defaultName;

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
