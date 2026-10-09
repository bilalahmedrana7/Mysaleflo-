import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/routes';
import { serverDb } from './src/server/db';
import { hashPassword, snapshotSessions, restoreSessions } from './src/server/auth';
import { storage, closeStorage, dataFile } from './src/server/storage';
import { snapshotServerDb, restoreServerDb, createSaver } from './src/server/persist';
import { MAX_SYNC_BYTES } from './src/server/dealerSync';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_PROD = process.env.NODE_ENV === 'production';
const SNAPSHOT_KEY = 'server-snapshot';
const SESSIONS_KEY = 'sessions';

function loadSnapshot() {
  const row = storage().get(SNAPSHOT_KEY);
  if (row) {
    restoreServerDb(serverDb as unknown as Record<string, unknown>, row.value);
    console.log(`Loaded saved data from ${dataFile()} (snapshot v${row.version}).`);
  } else {
    console.log(`No saved data found. Starting fresh at ${dataFile()}.`);
  }
  const sessions = storage().get(SESSIONS_KEY);
  if (sessions) restoreSessions(sessions.value); // keep people logged in across restarts

  // The Super Admin password comes from SUPER_ADMIN_PASSWORD on the very first start only, so a password
  // changed inside the app is not undone by a restart. To force a reset (forgotten password), start once
  // with RESET_SUPER_ADMIN_PASSWORD=1.
  if (IS_PROD && process.env.SUPER_ADMIN_PASSWORD && (process.env.RESET_SUPER_ADMIN_PASSWORD === '1')) {
    const admin = serverDb.users.find((u) => u.role === 'SUPER_ADMIN');
    if (admin) {
      const h = hashPassword(process.env.SUPER_ADMIN_PASSWORD);
      admin.passwordHash = h.hash;
      admin.passwordSalt = h.salt;
      console.log('Super Admin password was reset from the environment. Remove RESET_SUPER_ADMIN_PASSWORD now.');
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  loadSnapshot();
  const saver = createSaver(() => {
    storage().set(SNAPSHOT_KEY, snapshotServerDb(serverDb as unknown as Record<string, unknown>));
    storage().set(SESSIONS_KEY, snapshotSessions());
  });
  saver.flush(); // persist the initial/seeded state right away

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Request log (method, path without query, status, ms) — never logs bodies or tokens
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      }
    });
    next();
  });

  // Larger limit only for the dealer data sync; everything else stays small
  app.use('/api/dealer/sync', express.json({ limit: MAX_SYNC_BYTES }));
  app.use(express.json({ limit: '1mb' }));

  // Save server data after any successful write
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      res.on('finish', () => {
        if (res.statusCode < 400) saver.schedule();
      });
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    const dbOk = storage().ping();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'healthy' : 'degraded',
      platform: 'My Saleflo',
      database: dbOk ? 'ok' : 'unavailable',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use('/api', apiRouter);

  // Unknown API paths return JSON, not the web page
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // Works both from the project root (tsx server.ts) and from the bundled dist-server/server.js
    const rootDist = path.resolve(__dirname, 'dist');
    const distPath = fs.existsSync(rootDist) ? rootDist : path.resolve(__dirname, '..', 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          // the service worker file must always be checked for updates
          if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Central error handler: no stack traces to clients
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request is too large.', code: 'TOO_LARGE' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON.', code: 'BAD_JSON' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong on the server.', code: 'SERVER_ERROR' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Saleflo server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received: saving data and shutting down...`);
    saver.flush();
    server.close(() => {
      closeStorage();
      process.exit(0);
    });
    setTimeout(() => {
      closeStorage();
      process.exit(0);
    }, 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error starting My Saleflo server:', err);
  process.exit(1);
});
