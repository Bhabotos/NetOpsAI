import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import healthRouter   from './routes/health';
import alarmsRouter   from './routes/alarms';
import incidentsRouter from './routes/incidents';
import devicesRouter  from './routes/devices';
import agentsRouter   from './routes/agents';
import { requireApiKey } from './middleware/auth';

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use(generalLimiter);

// ── Request logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (process.env.LOG_REQUESTS !== 'false') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
// Public: health check
app.use('/api/health', healthRouter);

// Protected: dashboard data
app.use('/api/alarms',    requireApiKey, alarmsRouter);
app.use('/api/incidents', requireApiKey, incidentsRouter);
app.use('/api/devices',   requireApiKey, devicesRouter);
// devicesRouter serves topology at '/topology'; rewrite so GET /api/topology reaches it
app.use('/api/topology',  requireApiKey, (req, res, next) => { req.url = '/topology'; devicesRouter(req, res, next); });
app.use('/api/agents',    requireApiKey, agentsRouter);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[NetOpsAI] Backend API running on port ${PORT}`);
  console.log(`[NetOpsAI] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[NetOpsAI] Auth: ${process.env.API_KEY ? 'enabled' : 'disabled (dev mode)'}`);
  console.log(`[NetOpsAI] DB: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'netopsai'}`);
});

export default app;
