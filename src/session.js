import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

const sessions = new Map();

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;

export function createSession({ token, account, client }) {
  const id = randomBytes(32).toString('base64url');
  const now = Date.now();
  const session = {
    id,
    token,
    account,
    client,
    createdAt: now,
    lastSeen: now,
    destroyed: false,
    jobs: new Map(),
    activeJobId: null,
    events: new EventEmitter(),
    streams: new Set(),
    auto: {
      enabled: false,
      timer: null,
      scanning: false,
      seen: new Set(),
      lastScanAt: null,
      lastError: null,
    },
  };
  session.events.setMaxListeners(50);
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() >= sessionExpiry(session)) {
    destroySession(id, 'expired');
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

export function peekSession(id) {
  return sessions.get(id) ?? null;
}

export function sessionExpiry(session) {
  return Math.min(session.createdAt + SESSION_ABSOLUTE_MS, session.lastSeen + SESSION_IDLE_MS);
}

export function destroySession(id, reason = 'logout') {
  const session = sessions.get(id);
  if (!session) return false;

  session.destroyed = true;
  if (session.auto.timer) {
    clearInterval(session.auto.timer);
    session.auto.timer = null;
  }
  session.auto.enabled = false;

  // Drop the credential immediately.
  session.token = null;
  session.client = null;

  try {
    session.events.emit('event', { type: 'ended', data: { reason } });
  } catch {
    // A listener must never block teardown.
  }

  for (const res of session.streams) {
    try {
      res.end();
    } catch {
      // Already closed.
    }
  }
  session.streams.clear();
  sessions.delete(id);
  return true;
}

export function sweepSessions() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (now >= sessionExpiry(session)) destroySession(session.id, 'expired');
  }
}

export function addStream(session, res) {
  session.streams.add(res);
  return () => session.streams.delete(res);
}

export function emitSession(session, type, data) {
  if (session.destroyed) return;
  try {
    session.events.emit('event', { type, data });
  } catch {
    // Ignore broken subscribers.
  }
}

export function destroyAllSessions() {
  for (const id of [...sessions.keys()]) destroySession(id, 'shutdown');
}

export function sessionCount() {
  return sessions.size;
}
