import { prisma } from './prisma.js';
import { activeRoomWhere } from './accessCode.js';

export async function roomsForParticipant(participantId) {
  const rows = await prisma.roomMembership.findMany({
    where: {
      participantId,
      chatRoom: activeRoomWhere(),
    },
    include: { chatRoom: true },
    orderBy: { chatRoom: { name: 'asc' } },
  });

  return rows.map((m) => ({
    id: m.chatRoom.id,
    name: m.chatRoom.name,
    displayName: m.displayName,
    membershipId: m.id,
  }));
}
