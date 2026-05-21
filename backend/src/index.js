import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';
import { attachSocket } from './socket/index.js';
import { startWeeklyCleanup } from './jobs/weeklyCleanup.js';
import { seedAdminIfNeeded } from './utils/seedAdmin.js';

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'association-spirale' });
});

app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

attachSocket(server);
startWeeklyCleanup();

const port = Number(process.env.PORT || 3000);

async function main() {
  await seedAdminIfNeeded();
  server.listen(port, () => {
    console.log(`[server] Association Spirale — port ${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
