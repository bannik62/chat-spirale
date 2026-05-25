import { prisma } from './prisma.js';
import { activeRoomWhere } from './accessCode.js';

export async function roomsForParticipant(participantId) {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
  });

  const rows = await prisma.roomMembership.findMany({
    where: {
      participantId,
      chatRoom: activeRoomWhere(),
    },
    include: { chatRoom: true },
    orderBy: { chatRoom: { name: 'asc' } },
  });

  const globalName = participant?.displayName ?? null;

  return rows.map((m) => ({
    id: m.chatRoom.id,
    name: m.chatRoom.name,
    displayName: globalName ?? m.displayName,
    membershipId: m.id,
  }));
}
