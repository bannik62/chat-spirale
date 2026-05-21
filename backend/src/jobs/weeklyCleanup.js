import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';

/** Chaque vendredi à 23:59 — supprime les chats expirés (expiresAt passé). */
export function startWeeklyCleanup() {
  cron.schedule('59 23 * * 5', async () => {
    const now = new Date();
    const deleted = await prisma.chatRoom.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });
    console.log(`[cron] ${deleted.count} chat(s) expiré(s) supprimé(s)`);
  });
  console.log('[cron] Nettoyage hebdomadaire programmé (vendredi 23:59)');
}
