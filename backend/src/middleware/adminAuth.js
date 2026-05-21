import jwt from 'jsonwebtoken';

export function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    req.admin = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide' });
  }
}
