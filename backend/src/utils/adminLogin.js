import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export async function verifyAdminCredentials(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@') || !password) return null;

  const admin = await prisma.adminUser.findUnique({ where: { email: normalized } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return null;
  }
  return admin;
}

export function createAdminJwt(admin) {
  return jwt.sign(
    { sub: admin.id, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

export function getAdminFromRequest(req) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer || req.cookies?.spirale_admin;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
