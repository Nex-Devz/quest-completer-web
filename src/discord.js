import { randomUUID } from 'node:crypto';
import { AuthError, DiscordError } from './errors.js';

const API_BASE = (process.env.DISCORD_API_BASE || 'https://discord.com/api/v10').replace(/\/+$/, '');
const MAX_RETRIES = 4;
const RETRYABLE = new Set([500, 502, 503, 504]);

export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 ' +
  'Electron/37.6.0 Safari/537.36';

const PROPERTIES = {
  os: 'Windows',
  browser: 'Discord Client',
  release_channel: 'stable',
  client_version: '1.0.9215',
  os_version: '10.0.19045',
  os_arch: 'x64',
  app_arch: 'x64',
  system_locale: 'en-US',
  has_client_mods: false,
  client_launch_id: randomUUID(),
  browser_user_agent: USER_AGENT,
  browser_version: '37.6.0',
  os_sdk_version: '19045',
  client_build_number: 471091,
  native_build_number: 72186,
  client_event_source: null,
  launch_signature: randomUUID(),
  client_heartbeat_session_id: randomUUID(),
  client_app_state: 'focused',
};

const SUPER_PROPERTIES = Buffer.from(JSON.stringify(PROPERTIES)).toString('base64');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function sanitizeToken(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^```[\w-]*\r?\n?/, '')
    .replace(/\r?\n?```$/, '')
    .replace(/^`+|`+$/g, '')
    .replace(/^Bot\s+/i, '')
    .replace(/^"+|"+$/g, '')
    .trim();
}

export function isValidUserToken(token) {
  return (
    typeof token === 'string' &&
    token.length >= 50 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  );
}

function buildHeaders(token) {
  return {
    Authorization: token,
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    Origin: 'https://discord.com',
    Referer: 'https://discord.com/channels/@me',
    Pragma: 'no-cache',
    Priority: 'u=1, i',
    'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Debug-Options': 'bugReporterEnabled',
    'X-Discord-Locale': 'en-US',
    'X-Discord-Timezone': 'UTC',
    'X-Super-Properties': SUPER_PROPERTIES,
  };
}

function avatarUrl(user) {
  if (!user?.avatar) return null;
  const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=80`;
}

export function toAccount(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name || user.username,
    avatarUrl: avatarUrl(user),
  };
}

export async function verifyToken(token) {
  let response;
  try {
    response = await fetch(`${API_BASE}/users/@me`, {
      headers: buildHeaders(token),
      redirect: 'follow',
    });
  } catch (error) {
    throw new DiscordError(`Could not reach Discord: ${error?.message ?? error}`);
  }

  if (response.status === 401) {
    throw new AuthError('Discord rejected this token. It may be invalid or expired.');
  }
  if (!response.ok) {
    throw new DiscordError(
      `Discord responded with ${response.status} ${response.statusText}. Try again in a moment.`,
    );
  }

  const user = await response.json();
  if (user?.bot) {
    throw new AuthError('That is a bot token. This tool needs a user token.');
  }
  if (!user?.id) {
    throw new DiscordError('Discord returned an unexpected response.');
  }

  return toAccount(user);
}

export class QuestClient {
  #token;

  constructor(token) {
    this.#token = token;
  }

  setToken(token) {
    this.#token = token;
  }

  async request(method, path, body) {
    const url = `${API_BASE}${path}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      let response;
      try {
        response = await fetch(url, {
          method,
          headers: buildHeaders(this.#token),
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'follow',
        });
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 1000);
          continue;
        }
        throw new DiscordError(`Network error while contacting Discord: ${error?.message ?? error}`);
      }

      if (response.status === 401) {
        throw new AuthError('Discord rejected this token. It may be invalid or expired.');
      }

      if (response.status === 429) {
        let retryAfter = Number(response.headers.get('retry-after'));
        if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
          try {
            const body = await response.clone().json();
            retryAfter = Number(body?.retry_after);
          } catch {}
        }
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
        if (attempt < MAX_RETRIES) {
          await sleep(Math.min(waitMs, 30_000) + 250);
          continue;
        }
        const err = new DiscordError('Discord is rate limiting requests (429). Try again shortly.', 429);
        err.retryAfter = Number.isFinite(retryAfter) ? retryAfter : Math.ceil(waitMs / 1000);
        throw err;
      }

      if (!response.ok) {
        if (RETRYABLE.has(response.status) && attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 1500);
          continue;
        }
        const text = await response.text().catch(() => '');
        const detail = text.replace(/\s+/g, ' ').slice(0, 240);
        throw new DiscordError(
          `Discord returned ${response.status}${detail ? ` — ${detail}` : ''}`,
          response.status,
        );
      }

      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    throw new DiscordError('Discord did not respond after several attempts.');
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body = {}) {
    return this.request('POST', path, body);
  }

  async getQuests() {
    const response = await this.get('/quests/@me');
    return Array.isArray(response?.quests) ? response.quests : [];
  }

  enroll(questId) {
    return this.post(`/quests/${questId}/enroll`, {
      location: 11,
      is_targeted: false,
      metadata_raw: null,
    });
  }

  claimReward(questId) {
    return this.post(`/quests/${questId}/claim-reward`);
  }

  videoProgress(questId, timestamp) {
    return this.post(`/quests/${questId}/video-progress`, { timestamp });
  }

  heartbeat(questId, terminal) {
    return this.post(`/quests/${questId}/heartbeat`, {
      stream_key: null,
      terminal: Boolean(terminal),
    });
  }
}
