import { AuthError, HttpError } from './errors.js';
import { isPending, normalizeQuest } from './quests.js';
import { destroySession, emitSession } from './session.js';

const AUTO_INTERVAL_MS = 5 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let jobCounter = 0;

function extractStatus(response) {
  if (response && typeof response === 'object') {
    if (response.user_status && typeof response.user_status === 'object') return response.user_status;
    if ('enrolled_at' in response || 'completed_at' in response || 'progress' in response) return response;
  }
  return null;
}

function cleanError(error) {
  return String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 220);
}

function emitJob(job, type, data) {
  const event = { seq: (job.seq += 1), ts: Date.now(), ...data };
  job.events.push({ type, data: event });
  if (job.events.length > 900) job.events.splice(0, job.events.length - 900);
  for (const listener of job.listeners) {
    try {
      listener({ type, data: event });
    } catch {
      // A dead subscriber must never stop a run.
    }
  }
}

function log(job, level, message, extra = {}) {
  emitJob(job, 'log', { level, message, ...extra });
}

function updateQuest(job, id, patch) {
  const previous = job.quests.get(id) ?? { id, name: 'Quest', state: 'queued' };
  const next = { ...previous, ...patch };
  job.quests.set(id, next);
  emitJob(job, 'quest', next);
  return next;
}

export function serializeJob(job, { events = false } = {}) {
  const payload = {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    stats: { ...job.stats },
    quests: job.targets.map((target) => job.quests.get(target.id) ?? {
      id: target.id,
      name: target.name,
      state: 'queued',
      progress: 0,
      target: 0,
      percent: 0,
    }),
    error: job.error ?? null,
  };
  if (events) payload.events = job.events.slice(-320);
  return payload;
}

export function listJobs(session) {
  return [...session.jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .map((job) => serializeJob(job));
}

export function getJob(session, id) {
  return session.jobs.get(id) ?? null;
}

export function subscribeJob(job, listener) {
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}

export function cancelJob(session, id) {
  const job = session.jobs.get(id);
  if (!job) throw new HttpError(404, 'job_not_found', 'That run no longer exists.');
  if (job.status !== 'running') throw new HttpError(409, 'job_finished', 'That run has already finished.');
  if (!job.cancelRequested) {
    job.cancelRequested = true;
    log(job, 'warn', 'Stopping after the current step…');
  }
  return serializeJob(job);
}

export function startJob(session, { type = 'manual', targets }) {
  if (session.activeJobId) {
    const active = session.jobs.get(session.activeJobId);
    if (active?.status === 'running') {
      throw new HttpError(409, 'run_in_progress', 'A run is already in progress. Wait for it to finish or stop it.');
    }
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    throw new HttpError(400, 'nothing_to_run', 'There are no quests to run.');
  }

  const id = `job_${Date.now().toString(36)}_${(jobCounter += 1).toString(36)}`;
  const job = {
    id,
    type,
    status: 'running',
    createdAt: Date.now(),
    finishedAt: null,
    cancelRequested: false,
    seq: 0,
    events: [],
    listeners: new Set(),
    targets: targets.map((target) => ({ id: target.id, name: target.name ?? 'Quest' })),
    quests: new Map(),
    stats: { completed: 0, failed: 0, claimed: 0, skipped: 0, total: targets.length },
    error: null,
  };

  for (const target of job.targets) {
    job.quests.set(target.id, {
      id: target.id,
      name: target.name ?? 'Quest',
      state: 'queued',
      progress: 0,
      target: 0,
      percent: 0,
      message: null,
    });
  }

  session.jobs.set(id, job);
  session.activeJobId = id;

  emitJob(job, 'job', { job: serializeJob(job) });
  emitSession(session, 'job', {
    id,
    status: 'running',
    type,
    summary: null,
    total: targets.length,
  });

  void executeJob(session, job);

  return job;
}

async function executeJob(session, job) {
  const client = session.client;
  const shouldCancel = () => job.cancelRequested || session.destroyed;
  let authFailure = null;

  try {
    log(
      job,
      'info',
      job.type === 'auto'
        ? `Auto-runner found ${job.targets.length} quest${job.targets.length === 1 ? '' : 's'}.`
        : `Run started with ${job.targets.length} quest${job.targets.length === 1 ? '' : 's'}.`,
    );

    const fresh = await client.getQuests();
    const byId = new Map(fresh.map((quest) => [quest.id, quest]));

    for (const target of job.targets) {
      if (shouldCancel()) break;

      const raw = byId.get(target.id);
      if (!raw) {
        job.stats.skipped += 1;
        updateQuest(job, target.id, {
          state: 'skipped',
          message: 'No longer available on this account.',
        });
        log(job, 'warn', `${target.name}: no longer available.`);
        continue;
      }

      const quest = normalizeQuest(raw);
      updateQuest(job, target.id, {
        name: quest.name,
        target: quest.task.targetSeconds,
        progress: quest.progressSeconds,
        percent: quest.progressPercent,
      });

      if (quest.status === 'claimed') {
        job.stats.skipped += 1;
        updateQuest(job, target.id, { state: 'skipped', percent: 100, message: 'Already completed and claimed.' });
        continue;
      }

      if (quest.status === 'claimable') {
        updateQuest(job, target.id, { state: 'done', percent: 100, message: 'Quest complete. Claim in Discord.' });
        log(job, 'info', `Reward ready for "${quest.name}". Claim manually on Discord: https://discord.com/quests`, { questId: target.id });
        continue;
      }

      if (quest.status === 'expired') {
        job.stats.skipped += 1;
        updateQuest(job, target.id, { state: 'skipped', message: 'This quest expired.' });
        log(job, 'warn', `${quest.name}: expired.`);
        continue;
      }

      if (!quest.task.supported) {
        job.stats.skipped += 1;
        const reason = quest.task.manualReason ?? 'This task type is not supported.';
        updateQuest(job, target.id, { state: 'skipped', message: reason });
        log(job, 'warn', `${quest.name}: ${reason}`);
        continue;
      }

      updateQuest(job, target.id, { state: 'running', message: 'Working…' });
      log(job, 'run', `${quest.name}: ${quest.task.text}.`, { questId: quest.id });

      try {
        await completeQuest(client, raw, {
          shouldCancel,
          log: (message) => log(job, 'run', message, { questId: quest.id }),
          progress: (done, total) => {
            const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            updateQuest(job, quest.id, {
              state: 'running',
              progress: done,
              target: total,
              percent,
              message: total > 0 ? `${Math.floor(done)} / ${total}s` : 'Working…',
            });
          },
        });

        if (shouldCancel()) {
          updateQuest(job, quest.id, { state: 'cancelled', message: 'Stopped.' });
          break;
        }

        job.stats.completed += 1;
        updateQuest(job, quest.id, {
          state: 'done',
          progress: quest.task.targetSeconds,
          target: quest.task.targetSeconds,
          percent: 100,
          message: 'Quest complete. Claim in Discord.',
        });
        log(job, 'success', `${quest.name}: completed! Claim reward manually on Discord: https://discord.com/quests`, { questId: quest.id });
      } catch (error) {
        if (error instanceof AuthError) throw error;
        job.stats.failed += 1;
        const message = cleanError(error);
        updateQuest(job, quest.id, { state: 'failed', message });
        log(job, 'error', `${quest.name}: ${message}`, { questId: quest.id });
      }

      if (!shouldCancel()) await sleep(1200);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      authFailure = error;
      job.error = 'Discord rejected the session token. Connect again to continue.';
      log(job, 'error', job.error);
    } else {
      job.error = cleanError(error);
      log(job, 'error', job.error);
    }
  } finally {
    job.finishedAt = Date.now();
    if (job.status === 'running') {
      job.status = authFailure ? 'error' : job.cancelRequested ? 'cancelled' : 'done';
    }

    if (job.status === 'cancelled') log(job, 'warn', 'Run stopped.');
    else if (job.status === 'done') {
      log(
        job,
        'success',
        `Finished — ${job.stats.completed} completed, ${job.stats.claimed} reward${
          job.stats.claimed === 1 ? '' : 's'
        } claimed${job.stats.failed ? `, ${job.stats.failed} failed` : ''}${
          job.stats.skipped ? `, ${job.stats.skipped} skipped` : ''
        }.`,
      );
    }

    emitJob(job, 'done', { job: serializeJob(job) });

    if (session.activeJobId === job.id) session.activeJobId = null;
    trimJobs(session);

    emitSession(session, 'job', {
      id: job.id,
      status: job.status,
      type: job.type,
      summary: { ...job.stats },
      total: job.targets.length,
    });
    emitSession(session, 'quests', { reason: 'job-finished', jobId: job.id });

    if (authFailure) {
      emitSession(session, 'expired', { reason: 'auth' });
      destroySession(session.id, 'token_rejected');
    }
  }
}

async function completeQuest(client, raw, { log: writeLog, progress, shouldCancel }) {
  const quest = normalizeQuest(raw);
  const task = quest.task;

  if (!raw.user_status?.enrolled_at) {
    writeLog(`Enrolling in "${quest.name}"…`);
    const response = await client.enroll(quest.id);
    const status = extractStatus(response);
    if (status) raw.user_status = { ...(raw.user_status ?? {}), ...status };
    writeLog('Enrolled. Discord will now track this quest.');
  }

  if (task.type === 'WATCH_VIDEO' || task.type === 'WATCH_VIDEO_ON_MOBILE') {
    await runVideoQuest(client, raw, task, { writeLog, progress, shouldCancel });
    return;
  }

  if (task.type === 'PLAY_ON_DESKTOP') {
    await runDesktopQuest(client, raw, task, { writeLog, progress, shouldCancel });
    return;
  }

  throw new Error(task.manualReason ?? 'This task type is not supported.');
}

async function runVideoQuest(client, raw, task, { writeLog, progress, shouldCancel }) {
  const target = Math.max(1, task.targetSeconds || 1);
  const enrolledAt = raw.user_status?.enrolled_at
    ? new Date(raw.user_status.enrolled_at).getTime()
    : Date.now();
  const progressKey = task.eventName ?? task.type;
  const rawProgress = raw.user_status?.progress?.[progressKey];
  let secondsDone = Math.max(0, Number(rawProgress?.value ?? rawProgress) || 0);

  progress(secondsDone, target);
  writeLog(`Simulating video playback for ${target}s.`);

  const deadline = Date.now() + (target + 180) * 1000;

  while (!shouldCancel()) {
    if (Date.now() > deadline) {
      throw new Error('The video progress endpoint did not confirm completion in time.');
    }

    const elapsed = Math.floor((Date.now() - enrolledAt) / 1000);
    const maxAllowed = elapsed + 10;
    const next = Math.min(target, secondsDone + 7);

    if (maxAllowed - secondsDone >= 7) {
      const timestamp = Math.min(target, next + Math.random() * 0.8);
      try {
        const response = await client.videoProgress(raw.id, timestamp);
        secondsDone = next;
        progress(secondsDone, target);

        if (response?.completed_at || response?.user_status?.completed_at) {
          writeLog('Discord confirmed the video quest.');
          return;
        }
      } catch (err) {
        if (err instanceof AuthError) throw err;
        const is429 = err?.status === 429 || /rate limit|429/i.test(err?.message || '');
        if (is429) {
          const retryAfter = Number(err.retryAfter) || 12;
          writeLog(`Discord rate limited (429). Pausing for ${retryAfter}s with backoff...`);
          for (let s = 0; s < retryAfter && !shouldCancel(); s++) {
            await sleep(1000);
          }
        } else {
          writeLog(`Video progress notice: ${cleanError(err)}`);
          await sleep(2500);
        }
      }
    }

    if (secondsDone >= target) break;
    await sleep(1000);
  }

  if (shouldCancel()) return;

  try {
    await client.videoProgress(raw.id, target);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // The final beat is best-effort; Discord usually marks completion on the previous one.
  }

  writeLog('Video watch time submitted.');
}

async function runDesktopQuest(client, raw, task, { writeLog, progress, shouldCancel }) {
  const target = Math.max(1, task.targetSeconds || 1);
  let done = normalizeQuest(raw).progressSeconds;

  progress(done, target);
  writeLog(`Sending desktop heartbeats every 30s. About ${Math.ceil((target - done) / 60)} min left.`);

  const deadline = Date.now() + (target + 600) * 1000;
  let consecutiveErrors = 0;
  let beats = 0;

  while (!shouldCancel()) {
    if (Date.now() > deadline) {
      throw new Error('Discord did not register completion before the timeout.');
    }

    try {
      const response = await client.heartbeat(raw.id, false);
      const status = extractStatus(response);
      if (status) raw.user_status = { ...(raw.user_status ?? {}), ...status };
      consecutiveErrors = 0;
      beats += 1;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      consecutiveErrors += 1;
      const is429 = error?.status === 429 || /rate limit|429/i.test(error?.message || '');
      if (is429) {
        const retryAfter = Number(error.retryAfter) || Math.min(60, 10 * 2 ** (consecutiveErrors - 1));
        writeLog(`Discord rate limited (429). Pausing with exponential backoff for ${retryAfter}s before retrying...`);
        for (let s = 0; s < retryAfter && !shouldCancel(); s++) {
          await sleep(1000);
        }
        continue;
      }
      writeLog(`Heartbeat failed (attempt ${consecutiveErrors}): ${cleanError(error)}`);
      if (consecutiveErrors >= 6) {
        throw new Error('Discord kept rejecting heartbeats.');
      }
      const backoffWait = Math.min(30_000, 3000 * 2 ** (consecutiveErrors - 1));
      await sleep(backoffWait);
      continue;
    }

    const latest = normalizeQuest(raw);
    done = latest.progressSeconds;
    progress(done, target);

    if (latest.completed) {
      writeLog('Discord marked the quest complete.');
      break;
    }
    if (done >= target) break;
    if (beats % 2 === 0) {
      writeLog(`Still running — ${Math.max(0, Math.ceil((target - done) / 60))} min remaining.`);
    }
    for (let s = 0; s < 30 && !shouldCancel(); s++) {
      await sleep(1000);
    }
  }

  try {
    const response = await client.heartbeat(raw.id, true);
    const status = extractStatus(response);
    if (status) raw.user_status = { ...(raw.user_status ?? {}), ...status };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // Terminal heartbeat is best-effort.
  }
}

export async function claimAllQuestRewards(client, writeLog = () => {}) {
  writeLog('info', 'Please claim your rewards manually in Discord: https://discord.com/quests');
  return 0;
}

function trimJobs(session) {
  const finished = [...session.jobs.values()]
    .filter((job) => job.status !== 'running')
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const job of finished.slice(10)) {
    session.jobs.delete(job.id);
  }
}

export function getAutoState(session) {
  return {
    enabled: session.auto.enabled,
    lastScanAt: session.auto.lastScanAt,
    nextScanAt:
      session.auto.enabled && session.auto.lastScanAt
        ? session.auto.lastScanAt + AUTO_INTERVAL_MS
        : null,
    lastError: session.auto.lastError ?? null,
    intervalMs: AUTO_INTERVAL_MS,
  };
}

export function setAuto(session, enabled) {
  const auto = session.auto;
  const next = Boolean(enabled);
  if (next === auto.enabled) return getAutoState(session);

  if (next) {
    auto.enabled = true;
    auto.seen.clear();
    auto.lastError = null;
    auto.timer = setInterval(() => {
      void scanForQuests(session);
    }, AUTO_INTERVAL_MS);
    auto.timer.unref?.();
    emitSession(session, 'auto', getAutoState(session));
    void scanForQuests(session);
  } else {
    auto.enabled = false;
    if (auto.timer) clearInterval(auto.timer);
    auto.timer = null;
    emitSession(session, 'auto', getAutoState(session));
  }

  return getAutoState(session);
}

async function scanForQuests(session) {
  const auto = session.auto;
  if (!auto.enabled || session.destroyed || auto.scanning) return;

  if (session.activeJobId) {
    auto.lastScanAt = Date.now();
    emitSession(session, 'auto', getAutoState(session));
    return;
  }

  auto.scanning = true;
  try {
    const raw = await session.client.getQuests();
    if (!auto.enabled || session.destroyed) return;

    const pending = raw
      .map(normalizeQuest)
      .filter((quest) => isPending(quest) && quest.task.supported && !auto.seen.has(quest.id));

    for (const quest of pending) auto.seen.add(quest.id);

    auto.lastScanAt = Date.now();
    auto.lastError = null;

    emitSession(session, 'auto', { ...getAutoState(session), claimed: 0 });

    if (pending.length > 0) {
      startJob(session, {
        type: 'auto',
        targets: pending.map((quest) => ({ id: quest.id, name: quest.name })),
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      auto.enabled = false;
      if (auto.timer) clearInterval(auto.timer);
      auto.timer = null;
      emitSession(session, 'expired', { reason: 'auth' });
      destroySession(session.id, 'token_rejected');
      return;
    }
    auto.lastError = cleanError(error);
    auto.lastScanAt = Date.now();
    emitSession(session, 'auto', getAutoState(session));
  } finally {
    auto.scanning = false;
  }
}
