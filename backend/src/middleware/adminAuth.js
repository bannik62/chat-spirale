import { getAdminFromRequest } from '../utils/adminLogin.js';

export function adminAuth(req, res, next) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  req.admin = admin;
  next();
}
