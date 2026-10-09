# Deploying My Saleflo

> **Netlify / Vercel / GitHub Pages will NOT work.** They only host ready-made web pages. My Saleflo also needs a running server (Node) and a persistent disk for its database, otherwise login fails with "Unexpected token '<' ... is not valid JSON". Use Render, Railway, Fly.io, a VPS, or Docker as described below.

Needs **Node 22.13+** (uses the built-in SQLite). Data is stored in one file: `data/saleflo.db`.

## 1. Any server / VPS
```
npm ci
npm run build
export NODE_ENV=production
export SUPER_ADMIN_PASSWORD='choose-a-long-password'   # first start only; change it later inside the app
export DATA_DIR=/var/lib/saleflo      # persistent folder
npm start
```
Put it behind HTTPS (Nginx/Caddy). Keep it running with `pm2` or `systemd`.

## 2. Docker
```
docker build -t my-saleflo .
docker run -d -p 3000:3000 -v saleflo-data:/data \
  -e SUPER_ADMIN_PASSWORD='choose-a-long-password' my-saleflo
```
The `-v saleflo-data:/data` part is what keeps your data safe across restarts and updates.

## 3. Managed hosts (Render, Railway, Fly.io)
Use the Dockerfile, **attach a persistent disk mounted at `/data`**, and set `SUPER_ADMIN_PASSWORD`.
Without a persistent disk the database is erased on every deploy.

## Backups
```
npm run backup            # copies the database into data/backups (keeps the last 14)
```
Run it daily (cron) and copy the files off the server. Dealers can also download their own backup
from **Subscription & Info**.

## Checks
- `GET /api/health` returns `{"status":"healthy"}` when the database is reachable.
- Logs show one line per API call (method, path, status, time). Passwords and tokens are never logged.

## Security checklist before going live
- [ ] HTTPS enabled
- [ ] `SUPER_ADMIN_PASSWORD` set (12+ characters)
- [ ] Persistent disk attached and a daily backup scheduled
- [ ] `NODE_ENV=production` (hides demo logins and test screens)

## AI Assistant settings
- Nothing is required: the built-in assistant works with no key.
- Optional smarter answers: set `ANTHROPIC_API_KEY` on the server (never in the browser or in code). Use `AI_MODE=builtin` to switch outside calls off completely.
- Set `APP_TIMEZONE` (default `Asia/Karachi`) so "today" and "this month" follow your local day.

## Offline app for order takers (important)
- The app must be served over **HTTPS** (a normal domain with a certificate). Phones only allow the offline app ("service worker") on HTTPS, so on plain http it will not install and will not open without signal.
- Each order taker must open the site **once with internet** and tap *Add to Home Screen*. After an update, the app refreshes itself the next time the phone has signal.
