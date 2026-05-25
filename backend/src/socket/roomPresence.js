/** Présence, frappe et lectures par salon (mémoire — pas persisté). */

/** @type {Map<string, Map<string, { userName: string, userEmail: string, typing: boolean, lastReadAt: Date | null }>>} */
const rooms = new Map();

function getMembers(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

export function joinRoom(roomId, participantId, { userName, userEmail }) {
  const members = getMembers(roomId);
  const prev = members.get(participantId);
  members.set(participantId, {
    userName,
    userEmail,
    typing: false,
    lastReadAt: prev?.lastReadAt ?? null,
  });
}

export function leaveRoom(roomId, participantId) {
  getMembers(roomId).delete(participantId);
  if (getMembers(roomId).size === 0) rooms.delete(roomId);
}

export function setTyping(roomId, participantId, typing) {
  const m = getMembers(roomId).get(participantId);
  if (m) m.typing = typing;
}

export function setLastRead(roomId, participantId, readAt) {
  const m = getMembers(roomId).get(participantId);
  if (m) m.lastReadAt = readAt;
}

export function roomSnapshot(roomId) {
  const members = getMembers(roomId);
  const online = [];
  const reads = [];
  const typers = [];
  for (const [participantId, m] of members) {
    online.push({ participantId, userName: m.userName, email: m.userEmail });
    reads.push({
      participantId,
      userName: m.userName,
      email: m.userEmail,
      readAt: m.lastReadAt?.toISOString() ?? null,
    });
    if (m.typing) typers.push(m.userName);
  }
  return { online, reads, typers };
}
