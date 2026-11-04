const TASK_ORDER = [
  'WATCH_VIDEO',
  'PLAY_ON_DESKTOP',
  'PLAY_ON_XBOX',
  'PLAY_ON_PLAYSTATION',
  'STREAM_ON_DESKTOP',
  'PLAY_ACTIVITY',
  'WATCH_VIDEO_ON_MOBILE',
];

const TASK_META = {
  WATCH_VIDEO: {
    label: 'Watch video',
    supported: true,
    manualReason: null,
  },
  WATCH_VIDEO_ON_MOBILE: {
    label: 'Watch video on mobile',
    supported: true,
    manualReason: null,
  },
  PLAY_ON_DESKTOP: {
    label: 'Play on desktop',
    supported: true,
    manualReason: null,
  },
  PLAY_ON_XBOX: {
    label: 'Play on Xbox',
    supported: false,
    manualReason: 'Xbox quests must be completed on an Xbox console.',
  },
  PLAY_ON_PLAYSTATION: {
    label: 'Play on PlayStation',
    supported: false,
    manualReason: 'PlayStation quests must be completed on a PlayStation console.',
  },
  STREAM_ON_DESKTOP: {
    label: 'Stream on desktop',
    supported: false,
    manualReason: 'Streaming quests must be completed in the Discord desktop app.',
  },
  PLAY_ACTIVITY: {
    label: 'Play activity',
    supported: false,
    manualReason: 'Activity quests must be completed in the Discord desktop app.',
  },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function getTaskConfig(config) {
  return config?.task_config ?? config?.task_config_v2 ?? null;
}

function pickTask(config) {
  const tasks = getTaskConfig(config)?.tasks ?? {};
  const entries = Object.entries(tasks);
  if (entries.length === 0) {
    return {
      type: null,
      label: 'Unknown task',
      supported: false,
      manualReason: 'Discord did not include task details for this quest.',
      target: 0,
      eventName: null,
    };
  }

  let pair = null;
  for (const key of TASK_ORDER) {
    if (tasks[key]) {
      pair = [key, tasks[key]];
      break;
    }
  }
  if (!pair) pair = entries[0];

  const [type, task] = pair;
  const meta = TASK_META[type] ?? {
    label: type.replaceAll('_', ' ').toLowerCase(),
    supported: false,
    manualReason: `Task type "${type}" is not supported.`,
  };

  return {
    type,
    label: meta.label,
    supported: meta.supported,
    manualReason: meta.manualReason,
    target: Math.max(0, Number(task?.target) || 0),
    eventName: task?.event_name ?? task?.type ?? type,
  };
}

function readProgress(userStatus, task) {
  const progress = userStatus?.progress;
  if (!progress || typeof progress !== 'object') return 0;

  const keys = [task.eventName, task.type].filter(Boolean);
  for (const key of keys) {
    const value = progress[key]?.value ?? progress[key];
    if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
  }

  for (const value of Object.values(progress)) {
    const candidate = value?.value ?? value;
    if (Number.isFinite(Number(candidate))) return Math.max(0, Number(candidate));
  }
  return 0;
}

function cdnUrl(raw) {
  if (!raw || raw === 'PLACEHOLDER') return null;
  const value = String(raw);
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.discordapp.com/${value.replace(/^\/+/, '')}`;
}

function parseRewards(config) {
  const rewards = config?.rewards_config?.rewards ?? [];
  return rewards.map((reward) => {
    const type = Number(reward?.type) || 0;
    const orbs = Number(reward?.orb_quantity) || 0;
    const premiumOrbs = Number(reward?.premium_orb_quantity) || 0;
    const quantity = Number(reward?.quantity) || 0;
    const name = reward?.messages?.name ?? null;

    let kind = 'other';
    if (type === 4 || orbs > 0) kind = 'orbs';
    else if (type === 3) kind = 'decoration';
    else if (type === 1) kind = 'code';
    else if (quantity > 0) kind = 'nitro';

    let fallback = 'Reward';
    if (kind === 'orbs') fallback = `${orbs} Orbs`;
    else if (kind === 'nitro') fallback = `${quantity} day${quantity === 1 ? '' : 's'} Nitro`;
    else if (kind === 'decoration') fallback = 'Avatar Decoration';
    else if (kind === 'code') fallback = 'Game reward';

    return {
      type,
      kind,
      name: name ?? fallback,
      orbs: orbs || null,
      premiumOrbs: premiumOrbs > orbs ? premiumOrbs : null,
      quantity: quantity || null,
      assetUrl: cdnUrl(reward?.asset),
    };
  });
}

function initials(name) {
  return String(name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function taskSentence(task) {
  if (!task.type) return 'Unknown task';
  const label = task.label;
  const target = task.target;
  if (!target) return label;
  if (task.type === 'WATCH_VIDEO' || task.type === 'WATCH_VIDEO_ON_MOBILE') {
    return target >= 60 ? `${label} · ${Math.ceil(target / 60)} min` : `${label} · ${target}s`;
  }
  return `${label} · ${Math.ceil(target / 60)} min`;
}

export function normalizeQuest(raw) {
  const config = raw?.config ?? {};
  const messages = config.messages ?? {};
  const userStatus = raw?.user_status ?? null;
  const task = pickTask(config);

  const completed = Boolean(userStatus?.completed_at);
  const claimed = Boolean(userStatus?.claimed_at);
  const enrolled = Boolean(userStatus?.enrolled_at);
  const expiresAt = config.expires_at ? new Date(config.expires_at).toISOString() : null;
  const expired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

  let status = 'available';
  if (completed) status = claimed ? 'claimed' : 'claimable';
  else if (expired) status = 'expired';
  else if (enrolled) status = 'in_progress';

  const progressSeconds = readProgress(userStatus, task);
  let progressPercent = 0;
  if (status === 'claimed' || status === 'claimable') {
    progressPercent = 100;
  } else if (task.target > 0) {
    progressPercent = Math.min(100, Math.round((progressSeconds / task.target) * 100));
  }

  const name = messages.quest_name ?? 'Untitled quest';
  const gameTitle = messages.game_title ?? config.application?.name ?? 'Discord';
  const publisher = messages.game_publisher ?? '';
  const accent = HEX_COLOR.test(config.colors?.primary ?? '') ? config.colors.primary : null;
  const assets = config.assets ?? {};
  const cta = config.cta_config ?? {};

  return {
    id: raw.id,
    name,
    gameTitle,
    publisher,
    description: messages.quest_description ?? '',
    accent,
    bannerUrl:
      cdnUrl(assets.hero) ??
      cdnUrl(assets.quest_bar_hero) ??
      cdnUrl(assets.game_tile_dark) ??
      cdnUrl(assets.game_tile_light),
    heroVideoUrl: cdnUrl(assets.quest_bar_hero_video),
    tileUrl: cdnUrl(assets.game_tile_dark ?? assets.game_tile_light ?? assets.game_tile),
    logotypeUrl: cdnUrl(assets.logotype_dark ?? assets.logotype_light ?? assets.logotype),
    ctaLabel: cta.button_label ?? null,
    ctaUrl: cta.link ?? config.application?.link ?? null,
    initials: initials(gameTitle),
    expiresAt,
    startsAt: config.starts_at ? new Date(config.starts_at).toISOString() : null,
    status,
    completed,
    claimed,
    enrolled,
    task: {
      type: task.type,
      label: task.label,
      text: taskSentence(task),
      targetSeconds: task.target,
      eventName: task.eventName,
      supported: task.supported,
      manualReason: task.manualReason,
    },
    progressSeconds: Math.min(progressSeconds, task.target || progressSeconds),
    progressPercent,
    rewards: parseRewards(config),
    claimedAt: userStatus?.claimed_at ?? null,
    completedAt: userStatus?.completed_at ?? null,
  };
}

export function summarize(quests) {
  const summary = {
    total: quests.length,
    pending: 0,
    claimable: 0,
    completed: 0,
    expired: 0,
  };

  for (const quest of quests) {
    if (quest.status === 'available' || quest.status === 'in_progress') summary.pending += 1;
    else if (quest.status === 'claimable') summary.claimable += 1;
    else if (quest.status === 'claimed') summary.completed += 1;
    else if (quest.status === 'expired') summary.expired += 1;
  }

  return summary;
}

export function isPending(quest) {
  return quest.status === 'available' || quest.status === 'in_progress';
}
