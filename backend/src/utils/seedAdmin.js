import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

export async function seedAdminIfNeeded() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({ data: { email, passwordHash } });
  console.log(`[seed] Admin créé : ${email}`);
}
