import crypto from 'crypto';
import { prisma } from './prisma.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateAccessCode(length = 8) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function normalizeAccessCode(input) {
  return String(input || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

export async function generateUniqueAccessCode() {
  for (let i = 0; i < 20; i++) {
    const accessCode = generateAccessCode(8);
    const exists = await prisma.participant.findUnique({ where: { accessCode } });
    if (!exists) return accessCode;
  }
  throw new Error('Impossible de générer un code unique');
}

export function activeRoomWhere() {
  const now = new Date();
  return {
    isActive: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}
