import { prisma } from './prisma.js';
import { generateUniqueAccessCode } from './accessCode.js';
import { sendInvitationEmail } from '../mail/sendInvitation.js';

/**
 * Ajoute une personne à un ou plusieurs salons (fusion).
 * Le code d'accès ne change jamais pour une personne existante.
 */
export async function addParticipantToRooms(email, chatRoomIds, options = {}) {
  const { sendEmailIfNew = true, sendEmailForce = false } = options;

  let participant = await prisma.participant.findUnique({ where: { email } });
  const isNew = !participant;

  if (!participant) {
    const accessCode = await generateUniqueAccessCode();
    participant = await prisma.participant.create({
      data: { email, accessCode },
    });
  } else if (participant.isRevoked) {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: { isRevoked: false },
    });
  }

  const addedRoomIds = [];
  for (const chatRoomId of chatRoomIds) {
    const existing = await prisma.roomMembership.findUnique({
      where: {
        participantId_chatRoomId: {
          participantId: participant.id,
          chatRoomId,
        },
      },
    });
    if (!existing) addedRoomIds.push(chatRoomId);

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

  const sendEmail =
    sendEmailForce || (isNew && sendEmailIfNew);

  let mail = { skipped: true };
  if (sendEmail) {
    mail = await sendInvitationEmail({
      to: email,
      accessCode: participant.accessCode,
    });
  }

  return {
    participant,
    isNew,
    accessCode: participant.accessCode,
    addedRoomIds,
    mail,
  };
}
