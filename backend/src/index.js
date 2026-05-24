import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { attachSocket } from './socket/index.js';
import { startWeeklyCleanup } from './jobs/weeklyCleanup.js';
import { seedAdminIfNeeded } from './utils/seedAdmin.js';
import { seedDevParticipantIfNeeded } from './utils/seedDev.js';
import { validateProductionEnv } from './utils/validateEnv.js';
import {
  securityHeaders,
  apiRateLimiter,
  corsOriginValidator,
  getAllowedOrigins,
} from './middleware/security.js';

validateProductionEnv();

const app = express();
const server = http.createServer(app);

if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(securityHeaders);

app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'association-spirale',
    version: 2,
    origins: process.env.NODE_ENV === 'production' ? undefined : getAllowedOrigins(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRateLimiter);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

attachSocket(server);
startWeeklyCleanup();

const port = Number(process.env.PORT || 3000);

async function main() {
  await seedAdminIfNeeded();
  await seedDevParticipantIfNeeded();
  server.listen(port, () => {
    console.log(`[server] Association Spirale v2 — port ${port}`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`[server] FRONTEND_URL=${process.env.FRONTEND_URL}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
