import { prisma } from './prisma.js';

export const DEV_PARTICIPANT_EMAIL =
  process.env.DEV_PARTICIPANT_EMAIL || 'participant.dev@spirale.local';
export const DEV_PARTICIPANT_CODE =
  process.env.DEV_PARTICIPANT_CODE || 'DEV8CODE';

const DEV_ROOMS = ['Salon dev — test', 'Atelier dev — groupe B'];

export async function seedDevParticipantIfNeeded() {
  if (process.env.DEV_SEED !== '1') return;

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:8081';

  const roomIds = [];
  for (const name of DEV_ROOMS) {
    let room = await prisma.chatRoom.findFirst({ where: { name } });
    if (!room) {
      room = await prisma.chatRoom.create({
        data: { name, expiresAt: null, isActive: true },
      });
    }
    roomIds.push(room.id);
  }

  let participant = await prisma.participant.findUnique({
    where: { email: DEV_PARTICIPANT_EMAIL },
  });

  if (!participant) {
    participant = await prisma.participant.create({
      data: {
        email: DEV_PARTICIPANT_EMAIL,
        accessCode: DEV_PARTICIPANT_CODE,
      },
    });
  } else {
    participant = await prisma.participant.update({
      where: { id: participant.id },
      data: { accessCode: DEV_PARTICIPANT_CODE, isRevoked: false },
    });
  }

  for (const chatRoomId of roomIds) {
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

  console.log('[seed-dev] ─── Compte participant (dev) ───');
  console.log(`[seed-dev] URL   : ${frontendUrl}`);
  console.log(`[seed-dev] Email : ${DEV_PARTICIPANT_EMAIL}`);
  console.log(`[seed-dev] Code  : ${DEV_PARTICIPANT_CODE}`);
  console.log(`[seed-dev] Salons: ${DEV_ROOMS.join(', ')}`);
}
