import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AuthError, DiscordError, HttpError } from './src/errors.js';
import {
  isValidUserToken,
  QuestClient,
  sanitizeToken,
  verifyToken,
} from './src/discord.js';
import { isPending, normalizeQuest, summarize } from './src/quests.js';
import {
  addStream,
  createSession,
  destroyAllSessions,
  destroySession,
  getSession,
  sessionCount,
  sessionExpiry,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  sweepSessions,
} from './src/session.js';
import {
  cancelJob,
  claimAllQuestRewards,
  getAutoState,
  getJob,
  listJobs,
  serializeJob,
  setAuto,
  startJob,
  subscribeJob,
} from './src/jobs.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const BODY_LIMIT = 16 * 1024;
const APP_ROUTES = new Set(['/dashboard', '/dashboard/quest']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net https://*.discordapp.com https://*.discordapp.net https://cdn.discord.com; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; " +
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
};

function getSecurityHeaders(req) {
  const headers = { ...SECURITY_HEADERS };
  if (req && isSecureRequest(req)) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

// --- Proxy-Aware IP Detection ---
function getClientIp(req) {
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    const cf = req.headers['cf-connecting-ip'];
    if (cf && typeof cf === 'string') return cf.trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
    const real = req.headers['x-real-ip'];
    if (real && typeof real === 'string') return real.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// --- Rate Limiting ---
const globalApiLimits = new Map();
const GLOBAL_API_WINDOW_MS = 60 * 1000;
const GLOBAL_API_MAX = 120;

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function cleanRateLimitBuckets() {
  const now = Date.now();
  for (const [ip, entry] of globalApiLimits.entries()) {
    if (now > entry.resetAt) globalApiLimits.delete(ip);
  }
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}
const rateLimitCleanTimer = setInterval(cleanRateLimitBuckets, 60_000);
rateLimitCleanTimer.unref?.();

function checkGlobalApiRate(req, res, ip) {
  const now = Date.now();
  let entry = globalApiLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + GLOBAL_API_WINDOW_MS };
    globalApiLimits.set(ip, entry);
  } else {
    entry.count += 1;
  }

  const remaining = Math.max(0, GLOBAL_API_MAX - entry.count);
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  res.setHeader('RateLimit-Limit', String(GLOBAL_API_MAX));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(resetSeconds));

  if (entry.count > GLOBAL_API_MAX) {
    res.setHeader('Retry-After', String(resetSeconds));
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment before trying again.');
  }
}

function checkLoginRate(req, res, ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, entry);
  } else {
    entry.count += 1;
  }

  const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - entry.count);
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  res.setHeader('RateLimit-Limit', String(LOGIN_MAX_ATTEMPTS));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(resetSeconds));

  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    res.setHeader('Retry-After', String(resetSeconds));
    throw new HttpError(
      429,
      'login_rate_limited',
      `Too many connection attempts. Try again in ${Math.ceil(resetSeconds / 60)} minute(s).`,
    );
  }
}

function sendJson(res, status, payload, extraHeaders = {}, req = null) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...getSecurityHeaders(req),
    ...extraHeaders,
  });
  res.end(body);
}

function sendError(res, status, code, message, extra = {}, req = null) {
  sendJson(res, status, { error: code, message, ...extra }, {}, req);
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        if (!tooLarge) {
          tooLarge = true;
          reject(new HttpError(413, 'payload_too_large', 'Request body is too large.'));
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) return;
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'invalid_json', 'Request body must be valid JSON.'));
      }
    });

    req.on('error', (error) => {
      if (!tooLarge) reject(error);
    });
  });
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function getSessionCookie(req) {
  return parseCookies(req.headers.cookie).qc_sid ?? null;
}

function isSecureRequest(req) {
  if (process.env.COOKIE_SECURE === '1') return true;
  if (req.socket.encrypted) return true;
  return req.headers['x-forwarded-proto'] === 'https';
}

function sessionCookie(req, id) {
  return [
    `qc_sid=${id}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    ...(isSecureRequest(req) ? ['Secure'] : []),
  ].join('; ');
}

function expiredCookie(req) {
  return [
    'qc_sid=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    ...(isSecureRequest(req) ? ['Secure'] : []),
  ].join('; ');
}

function checkOrigin(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'bad_origin', 'Request origin is not allowed.');
  }
  if (originHost !== req.headers.host) {
    throw new HttpError(403, 'bad_origin', 'Request origin is not allowed.');
  }
}

function serializeSession(session) {
  const active = session.activeJobId ? getJob(session, session.activeJobId) : null;
  return {
    account: session.account,
    createdAt: session.createdAt,
    lastSeen: session.lastSeen,
    expiresAt: sessionExpiry(session),
    lifetime: { idleMs: SESSION_IDLE_MS, absoluteMs: SESSION_ABSOLUTE_MS },
    auto: getAutoState(session),
    activeJob: active ? serializeJob(active) : null,
  };
}

function handleApiError(res, error, session = null) {
  if (error instanceof HttpError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof AuthError) {
    if (session) destroySession(session.id, 'token_rejected');
    sendError(res, 401, 'token_rejected', error.message);
    return;
  }
  if (error instanceof DiscordError) {
    sendError(res, 502, 'discord_error', error.message);
    return;
  }
  console.error('[api]', error?.stack ?? error);
  sendError(res, 500, 'internal_error', 'Something went wrong on the server.');
}

async function withSession(req, res, handler) {
  const session = getSession(getSessionCookie(req));
  if (!session) {
    sendError(res, 401, 'session_required', 'Your session has ended. Connect your account again.');
    return;
  }
  try {
    await handler(session);
  } catch (error) {
    handleApiError(res, error, session);
  }
}

function sortedQuests(raw) {
  const rank = { in_progress: 0, available: 1, claimable: 2, claimed: 3 };
  return raw
    .map(normalizeQuest)
    .filter((quest) => quest.status !== 'expired')
    .sort((a, b) => {
      const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

function writeSse(res, type, data) {
  if (res.writableEnded) return;
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

function openSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...SECURITY_HEADERS,
  });
  res.write(': connected\n\n');
  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 20_000);
  ping.unref?.();
  req.on('close', () => clearInterval(ping));
  return () => clearInterval(ping);
}

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, { ...getSecurityHeaders(req), Allow: 'GET, POST, DELETE, OPTIONS' });
    res.end();
    return;
  }

  if (pathname === '/api/health' || pathname === '/health') {
    if (method === 'GET' || method === 'HEAD') {
      sendJson(
        res,
        200,
        {
          ok: true,
          status: 'healthy',
          uptime: Math.floor(process.uptime()),
          sessions: sessionCount(),
          timestamp: Date.now(),
        },
        {},
        req,
      );
      return;
    }
  }

  const clientIp = getClientIp(req);
  checkGlobalApiRate(req, res, clientIp);

  if (pathname === '/api/session') {
    if (method === 'POST') {
      try {
        checkOrigin(req);
        checkLoginRate(req, res, clientIp);
        const body = await readJson(req);
        const token = sanitizeToken(body?.token);

        if (!token) throw new HttpError(400, 'missing_token', 'Paste your Discord user token.');
        if (token.length < 20 || token.length > 250 || !isValidUserToken(token)) {
          throw new HttpError(
            400,
            'invalid_format',
            'That does not look like a Discord user token. Expected a valid user token string.',
          );
        }

        const account = await verifyToken(token);

        const previousId = getSessionCookie(req);
        if (previousId) destroySession(previousId, 'replaced');

        const client = new QuestClient(token);
        const session = createSession({ token, account, client });

        res.setHeader('Set-Cookie', sessionCookie(req, session.id));
        sendJson(res, 200, { account, session: serializeSession(session) });
      } catch (error) {
        handleApiError(res, error);
      }
      return;
    }

    if (method === 'GET') {
      await withSession(req, res, async (session) => {
        sendJson(res, 200, { account: session.account, session: serializeSession(session) });
      });
      return;
    }

    if (method === 'DELETE') {
      try {
        checkOrigin(req);
        const sessionId = getSessionCookie(req);
        if (sessionId) destroySession(sessionId, 'logout');
        res.setHeader('Set-Cookie', expiredCookie(req));
        sendJson(res, 200, { ok: true });
      } catch (error) {
        handleApiError(res, error);
      }
      return;
    }

    sendError(res, 405, 'method_not_allowed', 'Method not allowed.');
    return;
  }

  if (pathname === '/api/quests' && method === 'GET') {
    await withSession(req, res, async (session) => {
      const raw = await session.client.getQuests();
      const quests = sortedQuests(raw);
      sendJson(res, 200, {
        quests,
        summary: summarize(quests),
        fetchedAt: Date.now(),
      });
    });
    return;
  }

  if (pathname === '/api/quests/run-all' && method === 'POST') {
    await withSession(req, res, async (session) => {
      checkOrigin(req);
      const raw = await session.client.getQuests();
      const pending = raw.map(normalizeQuest).filter(isPending);

      if (pending.length === 0) {
        throw new HttpError(400, 'nothing_to_run', 'There are no pending quests right now.');
      }

      const job = startJob(session, {
        type: 'manual',
        targets: pending.map((quest) => ({ id: quest.id, name: quest.name })),
      });

      sendJson(res, 202, { job: serializeJob(job) });
    });
    return;
  }

  if (pathname === '/api/quests/claim-all' && method === 'POST') {
    await withSession(req, res, async () => {
      checkOrigin(req);
      sendJson(res, 200, {
        claimed: 0,
        manual: true,
        url: 'https://discord.com/quests',
        message: 'Please claim your rewards manually from Discord at https://discord.com/quests',
      });
    });
    return;
  }

  let match = pathname.match(/^\/api\/quests\/([^/]+)\/run$/);
  if (match && method === 'POST') {
    await withSession(req, res, async (session) => {
      checkOrigin(req);
      const questId = decodeURIComponent(match[1]);
      const raw = await session.client.getQuests();
      const item = raw.find((quest) => quest.id === questId);

      if (!item) throw new HttpError(404, 'quest_not_found', 'That quest is no longer on this account.');

      const quest = normalizeQuest(item);
      if (!isPending(quest)) {
        throw new HttpError(409, 'quest_not_runnable', 'That quest cannot be run in its current state.');
      }
      if (!quest.task.supported) {
        throw new HttpError(
          409,
          'quest_not_supported',
          quest.task.manualReason ?? 'That task type is not supported.',
        );
      }

      const job = startJob(session, {
        type: 'manual',
        targets: [{ id: quest.id, name: quest.name }],
      });

      sendJson(res, 202, { job: serializeJob(job) });
    });
    return;
  }

  match = pathname.match(/^\/api\/quests\/([^/]+)\/claim$/);
  if (match && method === 'POST') {
    await withSession(req, res, async () => {
      checkOrigin(req);
      sendJson(res, 200, {
        claimed: false,
        manual: true,
        url: 'https://discord.com/quests',
        message: 'Please claim your reward manually from Discord at https://discord.com/quests',
      });
    });
    return;
  }

  if (pathname === '/api/jobs' && method === 'GET') {
    await withSession(req, res, async (session) => {
      sendJson(res, 200, {
        jobs: listJobs(session),
        activeJobId: session.activeJobId,
      });
    });
    return;
  }

  match = pathname.match(/^\/api\/jobs\/([^/]+)\/events$/);
  if (match && method === 'GET') {
    const session = getSession(getSessionCookie(req));
    if (!session) {
      sendError(res, 401, 'session_required', 'Your session has ended. Connect your account again.');
      return;
    }
    const job = getJob(session, decodeURIComponent(match[1]));
    if (!job) {
      sendError(res, 404, 'job_not_found', 'That run no longer exists.');
      return;
    }

    const stopPing = openSse(req, res);
    const unsubscribe = subscribeJob(job, ({ type, data }) => writeSse(res, type, data));
    const removeStream = addStream(session, res);

    for (const event of job.events) writeSse(res, event.type, event.data);

    req.on('close', () => {
      stopPing();
      unsubscribe();
      removeStream();
    });
    return;
  }

  match = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
  if (match && method === 'POST') {
    await withSession(req, res, async (session) => {
      checkOrigin(req);
      const job = cancelJob(session, decodeURIComponent(match[1]));
      sendJson(res, 200, { job });
    });
    return;
  }

  match = pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (match && method === 'GET') {
    await withSession(req, res, async (session) => {
      const job = getJob(session, decodeURIComponent(match[1]));
      if (!job) throw new HttpError(404, 'job_not_found', 'That run no longer exists.');
      sendJson(res, 200, { job: serializeJob(job, { events: true }) });
    });
    return;
  }

  if (pathname === '/api/events' && method === 'GET') {
    const session = getSession(getSessionCookie(req));
    if (!session) {
      sendError(res, 401, 'session_required', 'Your session has ended. Connect your account again.');
      return;
    }

    const stopPing = openSse(req, res);
    writeSse(res, 'ready', serializeSession(session));

    const listener = ({ type, data }) => writeSse(res, type, data);
    session.events.on('event', listener);
    const removeStream = addStream(session, res);

    req.on('close', () => {
      stopPing();
      session.events.off('event', listener);
      removeStream();
    });
    return;
  }

  if (pathname === '/api/auto' && method === 'POST') {
    await withSession(req, res, async (session) => {
      checkOrigin(req);
      const body = await readJson(req);
      if (typeof body?.enabled !== 'boolean') {
        throw new HttpError(400, 'invalid_body', 'Expected { "enabled": true | false }.');
      }
      const auto = setAuto(session, body.enabled);
      sendJson(res, 200, { auto });
    });
    return;
  }

  sendError(res, 404, 'not_found', 'API route not found.');
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relative = decoded === '/' || APP_ROUTES.has(decoded.replace(/\/+$/, ''))
    ? 'index.html'
    : decoded.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, relative);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return false;

  let info;
  try {
    info = await stat(file);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
    ...getSecurityHeaders(req),
  });

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
  return true;
}

async function requestHandler(req, res) {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;

    if (pathname === '/health') {
      sendJson(
        res,
        200,
        {
          ok: true,
          status: 'healthy',
          uptime: Math.floor(process.uptime()),
          sessions: sessionCount(),
          timestamp: Date.now(),
        },
        {},
        req,
      );
      return;
    }

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    const served = await serveStatic(req, res, pathname);
    if (!served) sendError(res, 404, 'not_found', 'Not found.', {}, req);
  } catch (error) {
    console.error('[server]', error?.stack ?? error);
    if (!res.headersSent) {
      sendError(res, 500, 'internal_error', 'Something went wrong on the server.', {}, req);
    } else {
      res.end();
    }
  }
}

const server = http.createServer(requestHandler);

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun && process.env.VERCEL !== '1') {
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  Quest Completer — web edition');
    console.log(`  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log('  Tokens are kept in server memory only. Nothing is written to disk.');
    console.log('  Sessions close after 2h idle, or immediately when you end them.');
    console.log('');
  });
}

const sweepTimer = setInterval(sweepSessions, 60_000);
sweepTimer.unref?.();

function shutdown() {
  clearInterval(sweepTimer);
  clearInterval(rateLimitCleanTimer);
  destroyAllSessions();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { requestHandler, server };
export default requestHandler;
