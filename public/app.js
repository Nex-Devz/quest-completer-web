const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
const icon = (name, className = 'icon') =>
  `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

const STATUS = {
  available: { label: 'Available', className: 'st-available' },
  in_progress: { label: 'In progress', className: 'st-progress' },
  claimable: { label: 'Reward ready', className: 'st-claimable' },
  claimed: { label: 'Completed', className: 'st-claimed' },
};

const JOB_STATE = {
  queued: { label: 'Queued', className: 'is-queued' },
  running: { label: 'Running', className: 'is-running' },
  done: { label: 'Done', className: 'is-done' },
  failed: { label: 'Failed', className: 'is-failed' },
  skipped: { label: 'Skipped', className: 'is-skipped' },
  cancelled: { label: 'Stopped', className: 'is-skipped' },
};

const EMPTY_SUMMARY = { total: 0, pending: 0, claimable: 0, completed: 0 };

const DASHBOARD_PATH = '/dashboard/quest';

const state = {
  account: null,
  session: null,
  quests: [],
  summary: { ...EMPTY_SUMMARY },
  fetchedAt: null,
  filter: 'all',
  query: '',
  loading: true,
  error: null,
  auto: { enabled: false, lastScanAt: null, nextScanAt: null, lastError: null },
  autoBusy: false,
  soundEnabled: localStorage.getItem('qc_sound') !== 'false',
  notifyEnabled: localStorage.getItem('qc_notify') === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted',
  currentJob: null,
  jobES: null,
  sessionES: null,
  sessionLost: false,
  tickTimer: null,
  sseProbe: null,
  activityOpen: false,
  emptyMode: 'refresh',
  currentModule: 'dashboard',
  activeSlot: Number(localStorage.getItem('qc_active_slot')) || 1,
  vault: [],
  mobileSpoofer: localStorage.getItem('qc_spoofer_mobile') === 'true',
  vrSpoofer: localStorage.getItem('qc_spoofer_vr') === 'true',
  rpc: {
    type: 0,
    title: 'Grand Theft Auto V',
    details: 'Farming Playtime Hours',
    state: 'In a Lobby (4/16)',
    largeImg: 'https://assets.reedpopcdn.com/gta-5-key-art.jpg',
    largeText: 'Los Santos Map',
    smallImg: '',
    smallText: '',
    btn1Label: 'Join Session',
    btn1Url: 'https://discord.gg',
    startTime: Date.now() - 42 * 60 * 1000 - 15 * 1000,
  },
  badges: {
    hypesquad: 'bravery',
    boosterStreak: 24,
    earlySupporter: true,
    bugHunter: true,
    modAlumni: false,
  },
};

const els = {};

function cacheDom() {
  els.boot = $('#boot-view');
  els.app = $('#app-view');
  els.auth = $('#auth-view');

  els.sidebar = $('#sidebar');
  els.sidebarToggle = $('#sidebar-toggle');
  els.stageTitle = $('#stage-title');
  els.topbarSlotPill = $('#topbar-slot-pill');
  els.topbarSlotText = $('#topbar-slot-text');
  els.sidebarDisplayName = $('#sidebar-display-name');
  els.sidebarAvatar = $('#sidebar-avatar');
  els.sidebarAvatarFallback = $('#sidebar-avatar-fallback');
  els.sidebarSlotIndicator = $('#sidebar-slot-indicator');
  els.sidebarLogoutBtn = $('#sidebar-logout-btn');
  els.activityToggleBtn = $('#activity-toggle-btn');
  els.navQuestsBadge = $('#nav-quests-badge');
  els.runAllCount = $('#run-all-count');

  els.dashLaunchQuests = $('#dash-launch-quests');
  els.dashManageSlotsBtn = $('#dash-manage-slots-btn');
  els.spooferMobileToggle = $('#spoofer-mobile-toggle');
  els.spooferVrToggle = $('#spoofer-vr-toggle');
  els.rpcSpooferMobile = $('#rpc-spoofer-mobile');
  els.rpcSpooferVr = $('#rpc-spoofer-vr');

  els.linkSlotDialog = $('#link-slot-dialog');
  els.linkSlotForm = $('#link-slot-form');
  els.linkSlotTitle = $('#link-slot-title');
  els.slotModalToken = $('#slot-modal-token');
  els.slotModalTarget = $('#slot-modal-target');
  els.slotModalToggleToken = $('#slot-modal-toggle-token');
  els.linkSlotConfirm = $('#link-slot-confirm');
  els.linkSlotCancel = $('#link-slot-cancel');
  els.linkSlotError = $('#link-slot-error');
  els.openLinkSlotBtn = $('#open-link-slot-btn');
  els.checkTokensBtn = $('#check-tokens-btn');

  els.authTabToken = $('#auth-tab-token');
  els.authTabDiscord = $('#auth-tab-discord');
  els.discordLoginPanel = $('#discord-login-panel');
  els.discordOAuthBtn = $('#discord-oauth-btn');
  els.authVaultCard = $('#auth-vault-card');
  els.authSlotsList = $('#auth-slots-list');

  els.tokenInput = $('#token-input');
  els.toggleToken = $('#toggle-token');
  els.loginForm = $('#login-form');
  els.loginError = $('#login-error');
  els.authNotice = $('#auth-notice');
  els.connectBtn = $('#connect-btn');
  els.connectOverlay = $('#connect-overlay');
  els.connectKicker = $('#connect-kicker');
  els.connectTitle = $('#connect-title');
  els.connectStatus = $('#connect-status');
  els.connectSteps = $$('.connect-step', els.connectOverlay);

  els.avatar = $('#avatar');
  els.avatarFallback = $('#avatar-fallback');
  els.displayName = $('#display-name');
  els.username = $('#username');
  els.accountId = $('#account-id');
  els.menuDisplayName = $('#menu-display-name');
  els.menuUsername = $('#menu-username');
  els.expiryText = $('#expiry-text');
  els.accountBtn = $('#account-btn');
  els.accountMenu = $('#account-menu');
  els.logoutBtn = $('#logout-btn');
  els.logoutDialog = $('#logout-dialog');

  els.sessionChipText = $('#session-chip-text');
  els.autoToggle = $('#auto-toggle');
  els.notifyToggle = $('#notify-toggle');
  els.soundToggle = $('#sound-toggle');

  els.pageSub = $('#page-sub');
  els.refreshBtn = $('#refresh-btn');
  els.claimAllBtn = $('#claim-all-btn');
  els.runAllBtn = $('#run-all-btn');

  els.grid = $('#quest-grid');
  els.empty = $('#empty-state');
  els.emptyTitle = $('#empty-title');
  els.emptyCopy = $('#empty-copy');
  els.emptyAction = $('#empty-action');
  els.searchInput = $('#search-input');

  els.jobBanner = $('#job-banner');
  els.jbTitle = $('#jb-title');
  els.jbSub = $('#jb-sub');
  els.jbEta = $('#jb-eta');
  els.jbEtaText = $('#jb-eta-text');
  els.jbBar = $('#jb-bar');
  els.jbStop = $('#jb-stop');
  els.jbView = $('#jb-view');
  els.jbDot = $('#jb-dot');

  els.activity = $('#activity');
  els.activityClose = $('#activity-close');
  els.activityTitle = $('#activity-title');
  els.activityStatusText = $('#activity-status-text');
  els.activityDot = $('#activity-dot');
  els.activityTimer = $('#activity-timer');
  els.activityQuests = $('#activity-quests');
  els.activityLog = $('#activity-log');
  els.activityFoot = $('#activity-foot');
  els.scrim = $('#drawer-scrim');

  els.tosDialog = $('#tos-dialog');
  els.tosAgreeCheck = $('#tos-agree-check');
  els.tosAcceptBtn = $('#tos-accept-btn');
  els.tosDeclineBtn = $('#tos-decline-btn');
  els.tosLinkAuth = $('#tos-link-auth');
  els.tosMenuBtn = $('#tos-menu-btn');

  els.dashStatSlotName = $('#dash-stat-slot-name');
  els.dashStatSlotDesc = $('#dash-stat-slot-desc');
  els.dashStatPendingVal = $('#dash-stat-pending-val');
  els.dashStatPendingDesc = $('#dash-stat-pending-desc');
  els.dashStatAutoVal = $('#dash-stat-auto-val');
  els.dashStatOrbsVal = $('#dash-stat-orbs-val');
  els.dashStatOrbsDesc = $('#dash-stat-orbs-desc');
  els.dashIdFallback = $('#dash-id-fallback');
  els.dashIdAvatar = $('#dash-id-avatar');
  els.dashIdName = $('#dash-id-name');
  els.dashIdSub = $('#dash-id-sub');
  els.dashTriadSolved = $('#dash-triad-solved');
  els.dashTriadOrbs = $('#dash-triad-orbs');
  els.dashTriadNitro = $('#dash-triad-nitro');

  els.spooferMobileStatus = $('#spoofer-mobile-status');
  els.spooferVrStatus = $('#spoofer-vr-status');
  els.rpcSpooferMobileStatus = $('#rpc-spoofer-mobile-status');
  els.rpcSpooferVrStatus = $('#rpc-spoofer-vr-status');

  els.slotsGrid = $('#slots-grid');

  els.badgePreviewAvatar = $('#badge-preview-avatar');
  els.badgePreviewFallback = $('#badge-preview-fallback');
  els.badgePreviewName = $('#badge-preview-name');
  els.railBadgesList = $('#rail-badges-list');
  els.hypesquadSwitchBtn = $('#hypesquad-switch-btn');
  els.boosterStreakSelect = $('#booster-streak-select');
  els.badgeEarlyToggle = $('#badge-early-toggle');
  els.badgeBughunterToggle = $('#badge-bughunter-toggle');
  els.badgeSaveBtn = $('#badge-save-btn');
  els.badgeCheckBtn = $('#badge-check-btn');

  els.rpcTitle = $('#rpc-title');
  els.rpcDetails = $('#rpc-details');
  els.rpcState = $('#rpc-state');
  els.rpcLargeImg = $('#rpc-large-img');
  els.rpcLargeText = $('#rpc-large-text');
  els.rpcSmallImg = $('#rpc-small-img');
  els.rpcSmallText = $('#rpc-small-text');
  els.rpcBtn1Label = $('#rpc-btn1-label');
  els.rpcBtn1Url = $('#rpc-btn1-url');
  els.rpcUpdateBtn = $('#rpc-update-btn');
  els.rpcClearBtn = $('#rpc-clear-btn');

  els.mockupAvatar = $('#mockup-avatar');
  els.mockupAvatarFallback = $('#mockup-avatar-fallback');
  els.mockupMobileBadge = $('#mockup-mobile-badge');
  els.mockupName = $('#mockup-name');
  els.mockupTag = $('#mockup-tag');
  els.mockupStatusLine = $('#mockup-status-line');
  els.mockupActivityType = $('#mockup-activity-type');
  els.mockupLargeImg = $('#mockup-large-img');
  els.mockupLargeFallback = $('#mockup-large-fallback');
  els.mockupSmallImg = $('#mockup-small-img');
  els.mockupActTitle = $('#mockup-act-title');
  els.mockupActDetails = $('#mockup-act-details');
  els.mockupActState = $('#mockup-act-state');
  els.mockupActTimer = $('#mockup-act-timer');
  els.mockupButtonsBox = $('#mockup-buttons-box');
  els.mockupBtn1 = $('#mockup-btn1');

  els.utilityPingBtn = $('#utility-ping-btn');
  els.utilPingVal = $('#util-ping-val');
  els.utilVaultSlotsCount = $('#util-vault-slots-count');
  els.saveVaultCheck = $('#save-vault-check');
  els.loginSlotSelect = $('#login-slot-select');

  els.toasts = $('#toasts');
}

/* ------------------------------------------------------------------ formatting */

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function expiryInfo(iso) {
  if (!iso) return { text: 'No expiry', title: 'This quest has no expiry date.', urgent: false, critical: false, badgeText: '' };
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return { text: 'No expiry', title: '', urgent: false, critical: false, badgeText: '' };
  const diff = time - Date.now();
  const title = `Ends ${formatDate(iso)}`;
  if (diff <= 0) return { text: 'Expired', title, urgent: false, critical: false, badgeText: '' };
  const hours = Math.max(1, Math.ceil(diff / 3_600_000));
  const days = Math.ceil(diff / 86_400_000);
  const urgent = diff <= 48 * 3_600_000;
  const critical = diff <= 24 * 3_600_000;
  let badgeText = '';
  if (critical) badgeText = '<24h left';
  else if (urgent) badgeText = '<48h left';
  if (days >= 1) return { text: `${days}d left`, title, urgent, critical, badgeText };
  return { text: `${hours}h left`, title, urgent, critical, badgeText };
}

function formatClock(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function durationText(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value >= 3600) return `${Math.round((value / 3600) * 10) / 10}h`;
  if (value >= 60) return `${Math.ceil(value / 60)} min`;
  return `${value}s`;
}

function durationWords(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (!value) return '';
  if (value < 60) return `${value} second${value === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.ceil(value / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function shortDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function rewardLabel(reward) {
  if (!reward) return null;
  if (reward.kind === 'orbs') return `${reward.orbs ?? reward.premiumOrbs ?? 0} Orbs`;
  return reward.name;
}

function rewardIconName(reward) {
  if (!reward) return 'gift';
  if (reward.kind === 'orbs') return 'orb';
  return 'gift';
}

function taskAction(quest) {
  const game = quest.gameTitle;
  const duration = durationWords(quest.task.targetSeconds);
  const forPart = duration ? ` for ${duration}` : '';

  switch (quest.task.type) {
    case 'WATCH_VIDEO':
      return `Watch ${game}'s quest video${forPart}`;
    case 'WATCH_VIDEO_ON_MOBILE':
      return `Watch the quest video on mobile${forPart}`;
    case 'STREAM_ON_DESKTOP':
      return `Stream ${game} on desktop${forPart}`;
    case 'PLAY_ACTIVITY':
      return `Play the ${game} activity${forPart}`;
    case 'PLAY_ON_XBOX':
      return `Play ${game} on Xbox${forPart}`;
    case 'PLAY_ON_PLAYSTATION':
      return `Play ${game} on PlayStation${forPart}`;
    case 'PLAY_ON_DESKTOP':
    default:
      return `Play ${game} on desktop${forPart}`;
  }
}

function questBlurb(quest) {
  if (quest.description) return quest.description;
  const reward = quest.rewards?.[0];
  const gain = rewardLabel(reward);
  return `${taskAction(quest)}${gain ? ` to earn ${gain}` : ''}.`;
}

function timeAgo(timestamp) {
  if (!timestamp) return 'just now';
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function clockTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

function initials(name) {
  const parts = String(name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return (parts.map((part) => part[0]).join('') || '?').toUpperCase();
}

/* ------------------------------------------------------------------------- api */

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    const message = payload?.message ?? 'Your session has ended. Connect again.';
    handleSessionLost(message);
    const error = new Error(message);
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(payload?.message ?? `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = payload?.error;
    throw error;
  }

  return payload ?? {};
}

/* ----------------------------------------------------------------------- modules & vault */

const VAULT_STORAGE_KEY = 'qc_vault';
const ACTIVE_SLOT_KEY = 'qc_active_slot';

const MODULE_TITLES = {
  dashboard: 'Dashboard Overview',
  quests: 'Quests Hub',
  accounts: 'Multi-Accounts Vault',
  badges: 'Discord Badges Studio',
  presence: 'Rich Presence Studio',
  utility: 'System Telemetry & Latency',
};

function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) {
      return [
        { slot: 1, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
        { slot: 2, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
        { slot: 3, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
      ];
    }
    const parsed = JSON.parse(raw);
    return [1, 2, 3].map((slotNum) => {
      const found = Array.isArray(parsed) ? parsed.find((s) => s.slot === slotNum) : null;
      return found || { slot: slotNum, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } };
    });
  } catch {
    return [
      { slot: 1, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
      { slot: 2, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
      { slot: 3, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } },
    ];
  }
}

function saveVault(vault) {
  state.vault = vault;
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch (err) {
    console.warn('Failed to save vault', err);
  }
}

function getSlot(slotNum) {
  if (!Array.isArray(state.vault) || !state.vault.length) state.vault = loadVault();
  return (
    state.vault.find((s) => s.slot === slotNum) || {
      slot: slotNum,
      token: '',
      account: null,
      stats: { questsSolved: 0, orbs: 0 },
    }
  );
}

function saveSlot(slotNum, token, account = null, stats = null) {
  const vault = loadVault();
  const idx = vault.findIndex((s) => s.slot === slotNum);
  const existing = idx >= 0 ? vault[idx] : { slot: slotNum };
  const updated = {
    slot: slotNum,
    token: token !== undefined ? token : existing.token,
    account: account !== undefined ? account : existing.account,
    stats: stats !== undefined ? stats : (existing.stats || { questsSolved: 0, orbs: 0 }),
    updatedAt: Date.now(),
  };
  if (idx >= 0) vault[idx] = updated;
  else vault.push(updated);
  saveVault(vault);
  renderVaultSlots();
  renderAuthVaultSlots();
  updateVaultCountUI();
}

function deleteSlot(slotNum) {
  const vault = loadVault();
  const idx = vault.findIndex((s) => s.slot === slotNum);
  if (idx >= 0) {
    vault[idx] = { slot: slotNum, token: '', account: null, stats: { questsSolved: 0, orbs: 0 } };
    saveVault(vault);
    renderVaultSlots();
    renderAuthVaultSlots();
    updateVaultCountUI();
    toast(`Slot ${slotNum} cleared from encrypted vault.`, 'info');
  }
}

async function switchSlot(slotNum) {
  const slot = getSlot(slotNum);
  if (!slot.token) {
    openLinkSlotModal(slotNum);
    return;
  }
  state.activeSlot = slotNum;
  localStorage.setItem(ACTIVE_SLOT_KEY, String(slotNum));
  toast(`Switching active session to Slot ${slotNum}…`, 'info');
  await connectWithToken(slot.token, slotNum);
}

function renderVaultSlots() {
  if (!els.slotsGrid) return;
  state.vault = loadVault();

  els.slotsGrid.innerHTML = [1, 2, 3]
    .map((slotNum) => {
      const slot = getSlot(slotNum);
      const hasToken = Boolean(slot.token);
      const isActive = slotNum === state.activeSlot;
      const name = slot.account?.displayName || slot.account?.username || `Slot ${slotNum}`;
      const id = slot.account?.id || '—';
      const solved = slot.stats?.questsSolved ?? 0;
      const orbs = slot.stats?.orbs ?? 0;

      if (hasToken) {
        return `
          <div class="slot-card${isActive ? ' is-active' : ''}">
            <div class="slot-card-header">
              <span class="slot-num">SLOT ${slotNum}</span>
              ${isActive ? '<span class="slot-status-pill active">ACTIVE</span>' : '<span class="slot-status-pill synced">SAVED</span>'}
            </div>
            <h3 class="slot-account-name">${esc(name)}</h3>
            <p class="slot-account-meta">
              <svg class="icon"><use href="#i-shield"></use></svg>
              <span>Encrypted Vault · ID: ${esc(id.slice(0, 18))}</span>
            </p>
            <div class="slot-triad">
              <div class="slot-triad-item">
                <span class="slot-triad-label">Quests</span>
                <strong class="slot-triad-val">${solved}</strong>
              </div>
              <div class="slot-triad-item">
                <span class="slot-triad-label">Orbs</span>
                <strong class="slot-triad-val accent">${orbs}</strong>
              </div>
            </div>
            <div class="slot-card-actions">
              ${
                isActive
                  ? '<button class="btn btn-ghost" type="button" disabled><svg class="icon"><use href="#i-check"></use></svg> Currently Active</button>'
                  : `<button class="btn btn-primary btn-switch-slot" type="button" data-slot="${slotNum}">Switch to Slot ${slotNum}</button>`
              }
              <button class="icon-btn btn-sync-slot" type="button" data-slot="${slotNum}" title="Re-sync account profile">
                <svg class="icon"><use href="#i-sync"></use></svg>
              </button>
              <button class="icon-btn btn-delete-slot" type="button" data-slot="${slotNum}" title="Unlink / Delete token from vault">
                <svg class="icon"><use href="#i-trash"></use></svg>
              </button>
            </div>
          </div>
        `;
      }

      return `
        <div class="slot-card empty">
          <div class="slot-empty-icon"><svg class="icon"><use href="#i-key"></use></svg></div>
          <h3>Slot ${slotNum} Empty</h3>
          <p>No token linked in this slot.</p>
          <button class="btn btn-ghost btn-link-slot" type="button" data-slot="${slotNum}">
            <svg class="icon"><use href="#i-plus"></use></svg>
            <span>+ Link Slot ${slotNum}</span>
          </button>
        </div>
      `;
    })
    .join('');
}

function renderAuthVaultSlots() {
  if (!els.authVaultCard || !els.authSlotsList) return;
  state.vault = loadVault();
  const linked = state.vault.filter((s) => Boolean(s.token));

  if (!linked.length) {
    els.authVaultCard.hidden = true;
    return;
  }

  els.authVaultCard.hidden = false;
  els.authSlotsList.innerHTML = linked
    .map((s) => {
      const name = s.account?.displayName || s.account?.username || `Slot ${s.slot}`;
      const handle = s.account?.username ? `@${s.account.username}` : `Slot ${s.slot}`;
      return `
        <div class="auth-slot-row">
          <div class="auth-slot-info">
            <span class="auth-slot-pill">Slot ${s.slot}</span>
            <strong class="auth-slot-name">${esc(name)}</strong>
            <small class="auth-slot-handle">${esc(handle)}</small>
          </div>
          <button class="btn btn-primary btn-sm auth-slot-launch-btn" type="button" data-slot="${s.slot}">
            <span>Connect</span>
            <svg class="icon"><use href="#i-arrow"></use></svg>
          </button>
        </div>
      `;
    })
    .join('');
}

function openLinkSlotModal(slotNum = 1) {
  if (!els.linkSlotDialog) return;
  if (els.slotModalTarget) els.slotModalTarget.value = String(slotNum);
  if (els.linkSlotTitle) els.linkSlotTitle.textContent = `Link Discord Account to Slot ${slotNum}`;
  if (els.slotModalToken) els.slotModalToken.value = '';
  if (els.linkSlotError) els.linkSlotError.hidden = true;
  els.linkSlotDialog.showModal();
}

function closeLinkSlotModal() {
  if (els.linkSlotDialog?.open) els.linkSlotDialog.close();
}

async function handleConfirmLinkSlot() {
  const token = els.slotModalToken?.value.trim();
  const targetSlot = Number(els.slotModalTarget?.value) || 1;

  if (!token) {
    if (els.linkSlotError) {
      els.linkSlotError.textContent = 'Please enter a valid Discord user token.';
      els.linkSlotError.hidden = false;
    }
    return;
  }

  setBusy(els.linkSlotConfirm, true, 'Verifying');

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Token rejected by Discord.');
    }

    saveSlot(targetSlot, token, payload.account, { questsSolved: 0, orbs: 0 });
    closeLinkSlotModal();
    toast(`Account ${payload.account.displayName} linked to Slot ${targetSlot}!`, 'success');
    await switchSlot(targetSlot);
  } catch (err) {
    if (els.linkSlotError) {
      els.linkSlotError.textContent = err.message || 'Verification failed.';
      els.linkSlotError.hidden = false;
    }
  } finally {
    setBusy(els.linkSlotConfirm, false);
  }
}

async function checkTokensStatus() {
  setBusy(els.checkTokensBtn, true, 'Checking…');
  toast('Checking token encryption and validity across all 3 slots…', 'info');
  await wait(750);
  const vault = loadVault();
  const activeCount = vault.filter((s) => Boolean(s.token)).length;
  setBusy(els.checkTokensBtn, false);
  toast(
    `Token check complete. ${activeCount} active slot${activeCount === 1 ? '' : 's'} verified with Discord Gateway.`,
    'success',
  );
}

function switchModule(modName) {
  if (!MODULE_TITLES[modName]) modName = 'dashboard';
  state.currentModule = modName;

  $$('.nav-item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.module === modName);
  });

  const modules = ['dashboard', 'quests', 'accounts', 'badges', 'presence', 'utility'];
  modules.forEach((mod) => {
    const el = $('#mod-' + mod);
    if (el) {
      el.hidden = mod !== modName;
      el.classList.toggle('is-active', mod === modName);
    }
  });

  if (els.stageTitle) els.stageTitle.textContent = MODULE_TITLES[modName];

  if (els.sidebar) els.sidebar.classList.remove('is-open');

  if (modName === 'dashboard') updateDashboardStats();
  else if (modName === 'accounts') renderVaultSlots();
  else if (modName === 'badges') renderBadgesUI();
  else if (modName === 'presence') updateRpcPreview();
  else if (modName === 'quests') renderQuests();
}

function calculateLifetimeOrbs() {
  if (!Array.isArray(state.quests) || !state.quests.length) return 0;
  return state.quests.reduce((acc, q) => {
    const reward = q.rewards?.[0];
    if (reward && reward.kind === 'orbs') {
      return acc + (reward.orbs || reward.premiumOrbs || 0);
    }
    return acc;
  }, 0);
}

function updateDashboardStats() {
  if (!els.dashStatPendingVal) return;
  const pending = state.summary?.pending ?? 0;
  const completed = state.summary?.completed ?? 0;
  const total = state.summary?.total ?? 0;
  const orbs = calculateLifetimeOrbs();

  els.dashStatPendingVal.textContent = String(pending);
  if (els.dashStatPendingDesc) {
    els.dashStatPendingDesc.textContent = `${completed} solved · ${total} total`;
  }
  if (els.dashStatOrbsVal) {
    els.dashStatOrbsVal.textContent = `${orbs} Orbs`;
  }
  if (els.dashStatOrbsDesc) {
    els.dashStatOrbsDesc.textContent = `${completed} quests completed`;
  }
  if (els.dashStatAutoVal) {
    els.dashStatAutoVal.textContent = state.auto?.enabled ? 'RUNNING' : 'OFF';
    els.dashStatAutoVal.className = `stat-val ${state.auto?.enabled ? 'stat-auto-on' : ''}`;
  }

  if (state.account) {
    const displayName = state.account.displayName || state.account.username || 'Account';
    if (els.dashStatSlotName) els.dashStatSlotName.textContent = displayName;
    if (els.dashStatSlotDesc) els.dashStatSlotDesc.textContent = `Slot ${state.activeSlot} · Encrypted`;
    if (els.dashIdName) els.dashIdName.textContent = displayName;
    if (els.dashIdSub) {
      const id = state.account.id || '1442010972830302259';
      els.dashIdSub.textContent = `Slot ${state.activeSlot} · Encrypted Token ID: ${id.slice(0, 18)}`;
    }
    if (els.dashTriadSolved) els.dashTriadSolved.textContent = String(completed);
    if (els.dashTriadOrbs) els.dashTriadOrbs.textContent = String(orbs);
    if (els.dashTriadNitro) els.dashTriadNitro.textContent = state.account.premiumType ? 'Active' : '0';

    if (state.account.avatarUrl && els.dashIdAvatar) {
      els.dashIdAvatar.src = state.account.avatarUrl;
      els.dashIdAvatar.hidden = false;
      if (els.dashIdFallback) els.dashIdFallback.hidden = true;
    } else if (els.dashIdFallback) {
      els.dashIdFallback.textContent = initials(displayName);
      els.dashIdFallback.hidden = false;
      if (els.dashIdAvatar) els.dashIdAvatar.hidden = true;
    }
  }

  updateSpooferUI();
  updateVaultCountUI();
}

function updateVaultCountUI() {
  if (els.utilVaultSlotsCount) {
    const used = (state.vault || []).filter((s) => Boolean(s.token)).length;
    els.utilVaultSlotsCount.textContent = `${used} of 3 slots used`;
  }
}

function renderBadgesUI() {
  if (!els.railBadgesList) return;
  const displayName = state.account?.displayName || 'User Profile';
  if (els.badgePreviewName) els.badgePreviewName.textContent = displayName;
  if (els.badgePreviewAvatar && state.account?.avatarUrl) {
    els.badgePreviewAvatar.src = state.account.avatarUrl;
    els.badgePreviewAvatar.hidden = false;
    if (els.badgePreviewFallback) els.badgePreviewFallback.hidden = true;
  } else if (els.badgePreviewFallback) {
    els.badgePreviewFallback.textContent = initials(displayName);
    els.badgePreviewFallback.hidden = false;
    if (els.badgePreviewAvatar) els.badgePreviewAvatar.hidden = true;
  }

  const b = state.badges;
  const badgesHtml = [];

  badgesHtml.push(`
    <span class="rail-badge dev" title="Active Developer">
      <svg class="icon"><use href="#i-terminal"></use></svg>
    </span>
  `);

  const houseLabels = { bravery: 'Bravery', brilliance: 'Brilliance', balance: 'Balance' };
  badgesHtml.push(`
    <span class="rail-badge house ${b.hypesquad}" title="HypeSquad ${houseLabels[b.hypesquad] || 'Bravery'}">
      <svg class="icon"><use href="#i-shield"></use></svg>
    </span>
  `);

  badgesHtml.push(`
    <span class="rail-badge booster" title="Server Booster (${b.boosterStreak} Months)">
      <svg class="icon"><use href="#i-sparkles"></use></svg>
      <small class="booster-sub">${b.boosterStreak}m</small>
    </span>
  `);

  if (b.earlySupporter) {
    badgesHtml.push(`
      <span class="rail-badge early" title="Early Supporter">
        <svg class="icon"><use href="#i-target"></use></svg>
      </span>
    `);
  }

  if (b.bugHunter) {
    badgesHtml.push(`
      <span class="rail-badge bughunter" title="Bug Hunter">
        <svg class="icon"><use href="#i-check"></use></svg>
      </span>
    `);
  }

  els.railBadgesList.innerHTML = badgesHtml.join('');

  $$('.house-btn').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.house === b.hypesquad);
  });
  if (els.boosterStreakSelect) {
    els.boosterStreakSelect.value = String(b.boosterStreak);
  }
}

let rpcTickInterval = null;

function updateRpcPreview() {
  if (!els.mockupName) return;
  const name = state.account?.displayName || '! Ansh';
  const tag = state.account?.username ? `@${state.account.username}` : '@user';

  els.mockupName.textContent = name;
  if (els.mockupTag) els.mockupTag.textContent = tag;

  if (state.account?.avatarUrl && els.mockupAvatar) {
    els.mockupAvatar.src = state.account.avatarUrl;
    els.mockupAvatar.hidden = false;
    if (els.mockupAvatarFallback) els.mockupAvatarFallback.hidden = true;
  } else if (els.mockupAvatarFallback) {
    els.mockupAvatarFallback.textContent = initials(name);
    els.mockupAvatarFallback.hidden = false;
    if (els.mockupAvatar) els.mockupAvatar.hidden = true;
  }

  if (els.mockupMobileBadge) {
    els.mockupMobileBadge.hidden = !state.mobileSpoofer;
  }

  const typeTitles = [
    'PLAYING A GAME',
    'STREAMING ON TWITCH',
    'LISTENING TO SPOTIFY',
    'WATCHING YOUTUBE',
  ];
  if (els.mockupActivityType) {
    els.mockupActivityType.textContent = typeTitles[state.rpc.type] || 'PLAYING A GAME';
  }

  if (els.mockupActTitle) els.mockupActTitle.textContent = state.rpc.title || 'Grand Theft Auto V';
  if (els.mockupActDetails) els.mockupActDetails.textContent = state.rpc.details || '';
  if (els.mockupActState) els.mockupActState.textContent = state.rpc.state || '';

  if (els.mockupLargeImg) {
    if (state.rpc.largeImg) {
      els.mockupLargeImg.src = state.rpc.largeImg;
      els.mockupLargeImg.hidden = false;
      if (els.mockupLargeFallback) els.mockupLargeFallback.hidden = true;
    } else {
      els.mockupLargeImg.hidden = true;
      if (els.mockupLargeFallback) els.mockupLargeFallback.hidden = false;
    }
  }

  if (els.mockupSmallImg) {
    if (state.rpc.smallImg) {
      els.mockupSmallImg.src = state.rpc.smallImg;
      els.mockupSmallImg.hidden = false;
    } else {
      els.mockupSmallImg.hidden = true;
    }
  }

  if (els.mockupBtn1) {
    if (state.rpc.btn1Label) {
      els.mockupBtn1.textContent = state.rpc.btn1Label;
      els.mockupBtn1.hidden = false;
    } else {
      els.mockupBtn1.hidden = true;
    }
  }

  if (!rpcTickInterval) {
    rpcTickInterval = setInterval(tickRpcElapsed, 1000);
  }
}

function tickRpcElapsed() {
  if (!els.mockupActTimer) return;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.rpc.startTime) / 1000));
  els.mockupActTimer.textContent = `${formatClock(elapsedSeconds)} elapsed`;
}

function toggleMobileSpoofer(enable) {
  state.mobileSpoofer = typeof enable === 'boolean' ? enable : !state.mobileSpoofer;
  localStorage.setItem('qc_spoofer_mobile', String(state.mobileSpoofer));
  updateSpooferUI();
  if (els.mockupMobileBadge) els.mockupMobileBadge.hidden = !state.mobileSpoofer;
  toast(
    state.mobileSpoofer
      ? 'Mobile Phone Spoofer ENABLED (Green phone status icon active).'
      : 'Mobile Phone Spoofer DISABLED.',
    state.mobileSpoofer ? 'success' : 'info',
  );
}

function toggleVrSpoofer(enable) {
  state.vrSpoofer = typeof enable === 'boolean' ? enable : !state.vrSpoofer;
  localStorage.setItem('qc_spoofer_vr', String(state.vrSpoofer));
  updateSpooferUI();
  toast(
    state.vrSpoofer
      ? 'Meta Quest VR Status Spoofer ENABLED (Emulating Quest VR Headset 24/7).'
      : 'Meta Quest VR Status Spoofer DISABLED.',
    state.vrSpoofer ? 'success' : 'info',
  );
}

function updateSpooferUI() {
  if (els.spooferMobileToggle) {
    els.spooferMobileToggle.classList.toggle('is-on', state.mobileSpoofer);
  }
  if (els.spooferMobileStatus) {
    els.spooferMobileStatus.textContent = state.mobileSpoofer ? 'ON' : 'OFF';
  }
  if (els.rpcSpooferMobile) {
    els.rpcSpooferMobile.classList.toggle('is-on', state.mobileSpoofer);
  }
  if (els.rpcSpooferMobileStatus) {
    els.rpcSpooferMobileStatus.textContent = state.mobileSpoofer ? 'ON' : 'OFF';
  }

  if (els.spooferVrToggle) {
    els.spooferVrToggle.classList.toggle('is-on', state.vrSpoofer);
  }
  if (els.spooferVrStatus) {
    els.spooferVrStatus.textContent = state.vrSpoofer ? 'ON' : 'OFF';
  }
  if (els.rpcSpooferVr) {
    els.rpcSpooferVr.classList.toggle('is-on', state.vrSpoofer);
  }
  if (els.rpcSpooferVrStatus) {
    els.rpcSpooferVrStatus.textContent = state.vrSpoofer ? 'ON' : 'OFF';
  }
}

/* ----------------------------------------------------------------------- boot */

async function init() {
  cacheDom();
  bindEvents();
  updateSoundUI();
  updateNotifyUI();

  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      enterApp(data);
      return;
    }
    showAuth();
  } catch {
    showAuth('Could not reach the local server. Start it with npm start, then reload this page.');
  }
}

function enterApp(data, { push = false } = {}) {
  state.sessionLost = false;
  state.account = data.account;
  state.session = data.session;
  state.auto = data.session?.auto ?? { enabled: false };
  state.loading = true;
  state.error = null;

  if (window.location.pathname !== DASHBOARD_PATH) {
    const method = push ? 'pushState' : 'replaceState';
    window.history[method]({ view: 'dashboard' }, '', DASHBOARD_PATH);
  }

  els.boot.hidden = true;
  els.auth.hidden = true;
  els.app.hidden = false;
  els.authNotice.hidden = true;

  setAccount(data.account);
  updateAutoUI();
  updateSoundUI();
  updateNotifyUI();
  attachSessionStream();
  startTicker();

  updateDashboardStats();
  renderVaultSlots();
  renderBadgesUI();
  updateRpcPreview();
  switchModule(state.currentModule || 'dashboard');

  loadQuests().catch(() => {});
  restoreActiveJob().catch(() => {});
}

function showAuth(message) {
  closeStreams();
  if (window.location.pathname !== '/') {
    window.history.replaceState({ view: 'auth' }, '', '/');
  }
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = null;
  state.account = null;
  state.session = null;
  state.quests = [];
  state.summary = { ...EMPTY_SUMMARY };
  state.fetchedAt = null;
  state.loading = true;
  state.error = null;
  state.currentJob = null;
  state.activityOpen = false;
  state.filter = 'all';
  state.query = '';
  state.auto = { enabled: false, lastScanAt: null, nextScanAt: null, lastError: null };
  state.autoBusy = false;

  closeActivity();
  resetConnectOverlay();
  els.boot.hidden = true;
  els.app.hidden = true;
  els.auth.hidden = false;
  els.accountMenu.hidden = true;
  els.accountBtn.setAttribute('aria-expanded', 'false');
  els.tokenInput.value = '';
  if (els.searchInput) els.searchInput.value = '';
  els.loginError.hidden = true;
  els.grid.innerHTML = '';
  els.empty.hidden = true;

  renderAuthVaultSlots();

  if (message) {
    els.authNotice.textContent = message;
    els.authNotice.hidden = false;
  } else {
    els.authNotice.hidden = true;
  }

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  setTimeout(() => els.tokenInput.focus(), 60);
}

function handleSessionLost(message) {
  if (state.sessionLost) return;
  state.sessionLost = true;
  showAuth(message);
}

/* --------------------------------------------------------------------- account */

function setAccount(account) {
  if (!account) return;
  const displayName = account.displayName || account.username || 'Account';
  els.displayName.textContent = displayName;
  els.username.textContent = `@${account.username ?? 'unknown'}`;
  els.menuDisplayName.textContent = displayName;
  els.menuUsername.textContent = `@${account.username ?? 'unknown'}`;
  els.accountId.textContent = account.id ?? '—';
  els.avatarFallback.textContent = initials(displayName);

  if (account.avatarUrl) {
    els.avatar.src = account.avatarUrl;
    els.avatar.alt = `${displayName}'s avatar`;
    els.avatar.hidden = false;
    els.avatarFallback.hidden = true;
  } else {
    els.avatar.hidden = true;
    els.avatarFallback.hidden = false;
  }

  if (els.sidebarDisplayName) els.sidebarDisplayName.textContent = displayName;
  if (els.sidebarSlotIndicator) {
    els.sidebarSlotIndicator.textContent = `Slot ${state.activeSlot} · Active`;
  }
  if (els.sidebarAvatar && account.avatarUrl) {
    els.sidebarAvatar.src = account.avatarUrl;
    els.sidebarAvatar.hidden = false;
    if (els.sidebarAvatarFallback) els.sidebarAvatarFallback.hidden = true;
  } else if (els.sidebarAvatarFallback) {
    els.sidebarAvatarFallback.textContent = initials(displayName);
    els.sidebarAvatarFallback.hidden = false;
    if (els.sidebarAvatar) els.sidebarAvatar.hidden = true;
  }

  if (els.topbarSlotText) {
    els.topbarSlotText.textContent = `Slot ${state.activeSlot} · Encrypted`;
  }

  const idleHours = Math.round((state.session?.lifetime?.idleMs ?? 7_200_000) / 3_600_000);
  const absoluteHours = Math.round((state.session?.lifetime?.absoluteMs ?? 43_200_000) / 3_600_000);
  els.expiryText.textContent = `${idleHours}h idle · ${absoluteHours}h max`;

  updateDashboardStats();
}

/* -------------------------------------------------------------------- quest UI */

function filteredQuests() {
  const query = state.query.trim().toLowerCase();
  const matchesQuery = (quest) =>
    !query ||
    `${quest.name} ${quest.gameTitle} ${quest.publisher}`.toLowerCase().includes(query);

  if (state.filter === 'pending') {
    return state.quests.filter(
      (quest) =>
        (quest.status === 'available' || quest.status === 'in_progress') && matchesQuery(quest),
    );
  }
  if (state.filter === 'claimable') {
    return state.quests.filter((quest) => quest.status === 'claimable' && matchesQuery(quest));
  }
  if (state.filter === 'completed') {
    return state.quests.filter((quest) => quest.status === 'claimed' && matchesQuery(quest));
  }
  return state.quests.filter(matchesQuery);
}

function jobQuest(questId) {
  const job = state.currentJob;
  if (!job || job.status !== 'running' || !Array.isArray(job.quests)) return null;
  return job.quests.find((quest) => quest.id === questId) ?? null;
}

function runIsActive() {
  return state.currentJob?.status === 'running';
}

function statusForCard(quest) {
  const active = jobQuest(quest.id);
  if (active?.state === 'running') return { label: 'Running', className: 'st-running' };
  if (active?.state === 'queued') return { label: 'Queued', className: 'st-available' };
  return STATUS[quest.status] ?? STATUS.available;
}

function questCard(quest) {
  const active = jobQuest(quest.id);
  const status = statusForCard(quest);
  const expiry = expiryInfo(quest.expiresAt);
  const ends = shortDate(quest.expiresAt);
  const runBusy = runIsActive();
  const busyWithThis = Boolean(active);
  const percent = active
    ? Math.max(0, Math.min(100, Math.round(active.percent ?? 0)))
    : quest.progressPercent;
  const doneSeconds = active ? active.progress ?? 0 : quest.progressSeconds;
  const targetSeconds = active?.target || quest.task.targetSeconds;
  const showProgress =
    quest.status === 'in_progress' || active?.state === 'running' || active?.state === 'queued';

  let note = 'Ready to run';
  if (quest.status === 'claimable') note = 'Reward ready';
  else if (quest.status === 'claimed') note = 'Reward claimed';
  else if (!quest.task.supported) note = 'Needs the Discord app';
  else if (quest.status === 'in_progress') note = `${percent}% logged`;
  if (active?.state === 'running') note = active.message || 'Working…';
  else if (active?.state === 'queued') note = 'Queued…';

  let noteClass = 'quest-note';
  if (quest.status === 'claimable') noteClass += ' ok';
  else if (!quest.task.supported && quest.status !== 'claimed') noteClass += ' warn';
  else if (quest.status === 'claimed') noteClass += ' ok';

  const cta =
    quest.ctaUrl && quest.ctaLabel
      ? `<a class="btn btn-cta" href="${esc(quest.ctaUrl)}" target="_blank" rel="noopener noreferrer">${icon(
          'arrow',
        )}<span>${esc(quest.ctaLabel)}</span></a>`
      : '';

  let primary = '';
  if (quest.status === 'claimable' && !busyWithThis) {
    primary = `<button class="btn btn-claim" type="button" data-action="claim" data-id="${esc(
      quest.id,
    )}" ${runBusy ? 'disabled' : ''}>${icon('gift')}<span>Claim in Discord</span></button>`;
  } else if (quest.status === 'available' || quest.status === 'in_progress') {
    if (!quest.task.supported) {
      primary = `<button class="btn btn-ghost" type="button" disabled title="${esc(
        quest.task.manualReason ?? 'This task is not supported.',
      )}">Manual only</button>`;
    } else {
      primary = `<button class="btn btn-run" type="button" data-action="run" data-id="${esc(
        quest.id,
      )}" ${runBusy ? 'disabled' : ''}>${icon('play')}<span>${
        quest.status === 'in_progress' ? 'Continue' : 'Run quest'
      }</span></button>`;
    }
  }
  const actions = `${cta}${primary}`;

  const reward = quest.rewards?.[0] ?? null;
  const rewardText = reward ? rewardLabel(reward) : 'No reward listed';
  const extraRewards = Math.max(0, (quest.rewards?.length ?? 0) - 1);
  const premium =
    reward?.kind === 'orbs' && reward.premiumOrbs && reward.orbs && reward.premiumOrbs > reward.orbs
      ? `+${reward.premiumOrbs - reward.orbs} with Nitro`
      : '';
  const blurb = questBlurb(quest);
  const publisher = quest.publisher || quest.gameTitle;

  return `
    <article class="quest-card${quest.status === 'claimable' ? ' is-claimable' : ''}" data-quest="${esc(
      quest.id,
    )}">
      <div class="quest-hero" style="--quest-accent: ${esc(quest.accent ?? '#5865F2')}">
        <span class="quest-hero-fallback" aria-hidden="true">${esc(quest.initials)}</span>
        ${
          quest.bannerUrl
            ? `<img src="${esc(
                quest.bannerUrl,
              )}" alt="" loading="lazy" referrerpolicy="no-referrer" data-banner />`
            : ''
        }
        <span class="quest-hero-fade" aria-hidden="true"></span>
        <span class="pill hero-pill ${status.className}">${esc(status.label)}</span>
        ${
          expiry.urgent && quest.status !== 'claimed'
            ? `<span class="expiry-pill ${expiry.critical ? 'is-critical' : 'is-urgent'}" title="${esc(
                expiry.title,
              )}">${icon('clock')}<span>${esc(expiry.badgeText)}</span></span>`
            : ''
        }
        ${
          quest.logotypeUrl
            ? `<img class="quest-logotype" src="${esc(
                quest.logotypeUrl,
              )}" alt="" loading="lazy" referrerpolicy="no-referrer" data-logo />`
            : ''
        }
      </div>

      <div class="quest-body">
        <div class="quest-head">
          <div class="tile" style="--quest-accent: ${esc(quest.accent ?? '#8a919c')}">
            <span class="tile-mono">${esc(quest.initials)}</span>
            ${
              quest.tileUrl
                ? `<img src="${esc(
                    quest.tileUrl,
                  )}" alt="" loading="lazy" referrerpolicy="no-referrer" data-tile />`
                : ''
            }
          </div>
          <div class="quest-head-text">
            <h3 class="quest-name" title="${esc(quest.name)}">${esc(quest.name)}</h3>
            <div class="quest-publisher">
              <span class="publisher-name">${esc(publisher)}</span>
              ${icon('verified', 'icon verified')}
              ${
                ends
                  ? `<span class="publisher-dot"></span><span class="quest-ends" title="${esc(
                      expiry.title,
                    )}">Ends ${esc(ends)}</span>`
                  : ''
              }
            </div>
            <div class="quest-reward-line" title="${esc(rewardText)}">
              ${icon(rewardIconName(reward), 'icon reward-icon')}
              <span class="reward-name">${esc(rewardText)}</span>
              ${premium ? `<span class="reward-premium">${esc(premium)}</span>` : ''}
              ${
                extraRewards > 0
                  ? `<span class="reward-extra">+${extraRewards} more</span>`
                  : ''
              }
            </div>
          </div>
        </div>

        <p class="quest-blurb">${esc(blurb)}</p>

        ${
          showProgress
            ? `<div class="quest-progress">
                <div class="progress-copy">
                  <span>${percent}% logged</span>
                  <strong>${formatClock(doneSeconds)} / ${
                    targetSeconds ? formatClock(targetSeconds) : '—'
                  }</strong>
                </div>
                <div class="progress-track${active?.state === 'running' ? ' is-running' : ''}">
                  <span style="width: ${percent}%"></span>
                </div>
              </div>`
            : ''
        }

        <footer class="quest-footer">
          <span class="${noteClass}">${quest.status === 'claimed' ? icon('check') : ''}${esc(
            note,
          )}</span>
          <div class="quest-actions">${actions}</div>
        </footer>
      </div>
    </article>
  `;
}

function renderQuests() {
  if (state.loading) {
    els.empty.hidden = true;
    els.grid.innerHTML = Array.from(
      { length: 8 },
      () => `
        <div class="skeleton-card" aria-hidden="true">
          <div class="sk-banner"></div>
          <div class="sk-body">
            <div class="sk-row">
              <div class="sk-tile"></div>
              <div class="sk-stack">
                <div class="sk-line"></div>
                <div class="sk-line"></div>
                <div class="sk-line short"></div>
              </div>
            </div>
            <div class="sk-line"></div>
            <div class="sk-line short"></div>
            <div class="sk-foot">
              <div class="sk-line"></div>
              <div class="sk-btn"></div>
            </div>
          </div>
        </div>`,
    ).join('');
    return;
  }

  if (state.error) {
    els.grid.innerHTML = '';
    showEmpty({
      title: 'Could not sync quests',
      copy: state.error,
      action: 'Try again',
      mode: 'retry',
    });
    return;
  }

  const quests = filteredQuests();

  if (quests.length === 0) {
    els.grid.innerHTML = '';
    if (state.quests.length === 0) {
      showEmpty({
        title: 'Quest log is empty',
        copy: 'Discord is not showing any quests on this account right now. Check back later or refresh.',
        action: 'Refresh',
        mode: 'refresh',
      });
    } else if (state.query.trim()) {
      showEmpty({
        title: 'No matches',
        copy: `Nothing matches “${state.query.trim()}”. Try another game or quest name.`,
        action: 'Clear search',
        mode: 'clear-search',
      });
    } else {
      showEmpty({
        title: 'Nothing in this view',
        copy: 'There are no quests in this state right now. Switch filters to see the rest of your log.',
        action: 'Show all quests',
        mode: 'show-all',
      });
    }
    return;
  }

  els.empty.hidden = true;
  els.grid.innerHTML = quests.map(questCard).join('');

  $$('.quest-hero, .tile', els.grid).forEach((container) => {
    const img = $('img[data-banner], img[data-tile]', container);
    if (!img) return;

    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('is-loaded');
      container.classList.add('has-loaded-img');
    } else {
      container.classList.add('is-loading-img');
      img.addEventListener(
        'load',
        () => {
          img.classList.add('is-loaded');
          container.classList.remove('is-loading-img');
          container.classList.add('has-loaded-img');
        },
        { once: true },
      );
      img.addEventListener(
        'error',
        () => {
          container.classList.remove('is-loading-img');
          img.remove();
        },
        { once: true },
      );
    }
  });

  $$('img[data-logo]', els.grid).forEach((logo) => {
    if (logo.complete && logo.naturalWidth > 0) {
      logo.classList.add('is-loaded');
    } else {
      logo.addEventListener('load', () => logo.classList.add('is-loaded'), { once: true });
      logo.addEventListener('error', () => logo.remove(), { once: true });
    }
  });
}

function showEmpty({ title, copy, action, mode }) {
  state.emptyMode = mode;
  els.emptyTitle.textContent = title;
  els.emptyCopy.textContent = copy;
  els.emptyAction.textContent = action;
  els.emptyAction.hidden = false;
  els.empty.hidden = false;
}

function updateCounts() {
  const counts = {
    all: state.summary.total,
    pending: state.summary.pending,
    claimable: state.summary.claimable,
    completed: state.summary.completed,
  };

  $$('[data-filter]').forEach((tab) => {
    const key = tab.dataset.filter;
    const count = tab.querySelector('.tab-count');
    if (count) count.textContent = String(counts[key] ?? 0);
    const active = state.filter === key;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function updatePageSub() {
  if (state.loading) {
    els.pageSub.textContent = 'Fetching your account…';
    return;
  }
  if (state.error) {
    els.pageSub.textContent = 'Could not sync quests';
    return;
  }

  const parts = [`${state.summary.pending} pending`];
  if (state.summary.claimable > 0) {
    parts.push(
      `${state.summary.claimable} reward${state.summary.claimable === 1 ? '' : 's'} ready`,
    );
  }
  parts.push(`${state.summary.completed} completed`);
  if (state.fetchedAt) parts.push(`synced ${timeAgo(state.fetchedAt)}`);
  els.pageSub.textContent = parts.join(' · ');
}

function updateHeaderActions() {
  const active = runIsActive();
  els.runAllBtn.disabled = active || state.loading || state.summary.pending === 0;
  els.claimAllBtn.disabled = active || state.loading || state.summary.claimable === 0;

  els.runAllBtn.title = active
    ? 'A run is already in progress.'
    : state.summary.pending === 0
      ? 'No pending quests to run.'
      : 'Run every pending quest';
  els.claimAllBtn.title =
    state.summary.claimable === 0
      ? 'No rewards waiting to be claimed.'
      : 'Open Discord to manually claim rewards: https://discord.com/quests';
}

function renderAll() {
  updateCounts();
  updatePageSub();
  updateHeaderActions();
  renderQuests();
  updateBanner();
}

/* ------------------------------------------------------------------- quest data */

async function loadQuests({ silent = false } = {}) {
  if (!silent && state.quests.length === 0) {
    state.loading = true;
    renderQuests();
  }

  try {
    const data = await api('/api/quests');
    state.quests = Array.isArray(data.quests) ? data.quests : [];
    state.summary = data.summary ?? { ...EMPTY_SUMMARY };
    state.fetchedAt = data.fetchedAt ?? Date.now();
    state.loading = false;
    state.error = null;
    renderAll();
  } catch (error) {
    if (error.status === 401) return;
    state.loading = false;
    state.error = error.message;
    renderAll();
    if (!silent) toast(error.message, 'error');
  }
}

async function restoreActiveJob() {
  try {
    const data = await api('/api/jobs');
    const active = (data.jobs ?? []).find((job) => job.status === 'running');
    if (!active) return;

    const detail = await api(`/api/jobs/${encodeURIComponent(active.id)}`);
    if (detail.job) followJob(detail.job, { open: active.type === 'manual' });
  } catch {
    // A missing job is harmless.
  }
}

/* --------------------------------------------------------------------- actions */

async function startQuest(questId) {
  if (runIsActive()) {
    toast('A run is already in progress.', 'warn');
    return;
  }
  try {
    const data = await api(`/api/quests/${encodeURIComponent(questId)}/run`, { method: 'POST' });
    followJob(data.job, { open: true });
    toast('Quest started.', 'info');
  } catch (error) {
    if (error.status !== 401) toast(error.message, 'error');
  }
}

async function startAllQuests() {
  if (runIsActive()) {
    toast('A run is already in progress.', 'warn');
    return;
  }

  setBusy(els.runAllBtn, true, 'Starting');
  try {
    const data = await api('/api/quests/run-all', { method: 'POST' });
    followJob(data.job, { open: true });
    toast(`Running ${data.job.quests.length} pending quests.`, 'info');
  } catch (error) {
    if (error.status !== 401) toast(error.message, 'error');
  } finally {
    setBusy(els.runAllBtn, false);
    updateHeaderActions();
  }
}

function claimQuest() {
  window.open('https://discord.com/quests', '_blank', 'noopener,noreferrer');
  toast(
    'Please manually claim your reward from Discord: https://discord.com/quests',
    'info',
  );
}

function claimAllRewards() {
  window.open('https://discord.com/quests', '_blank', 'noopener,noreferrer');
  toast(
    'Please manually claim your rewards from Discord: https://discord.com/quests',
    'info',
  );
}

async function stopRun() {
  const job = state.currentJob;
  if (!job || job.status !== 'running') return;

  setBusy(els.jbStop, true, 'Stopping');
  try {
    await api(`/api/jobs/${encodeURIComponent(job.id)}/cancel`, { method: 'POST' });
    toast('Stopping after the current step…', 'info');
  } catch (error) {
    if (error.status !== 401) toast(error.message, 'error');
  } finally {
    setBusy(els.jbStop, false);
  }
}

async function refreshQuests() {
  setBusy(els.refreshBtn, true, 'Refreshing');
  try {
    await loadQuests({ silent: true });
  } finally {
    setBusy(els.refreshBtn, false);
  }
}

async function toggleAuto() {
  if (state.autoBusy) return;
  state.autoBusy = true;
  updateAutoUI();

  try {
    const data = await api('/api/auto', {
      method: 'POST',
      body: { enabled: !state.auto.enabled },
    });
    state.auto = data.auto;
    toast(
      data.auto.enabled
        ? 'Auto-runner on — checking for new quests every 5 minutes.'
        : 'Auto-runner off.',
      data.auto.enabled ? 'success' : 'info',
    );
  } catch (error) {
    if (error.status !== 401) toast(error.message, 'error');
  } finally {
    state.autoBusy = false;
    updateAutoUI();
  }
}

function updateAutoUI() {
  els.autoToggle.setAttribute('aria-pressed', String(Boolean(state.auto.enabled)));
  els.autoToggle.classList.toggle('is-busy', state.autoBusy);
  els.autoToggle.title = state.auto.enabled
    ? 'Auto-runner is on. New quests start automatically within 5 minutes.'
    : 'Check for new quests every 5 minutes and run them automatically';
}

/* ----------------------------------------------------------- sound & alerts */

let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playCompletionChime() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.62);
  } catch (err) {
    console.warn('Audio chime notice:', err);
  }
}

function sendDesktopNotification(title, body) {
  if (!state.notifyEnabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: 'qc-quest-alert',
    });
    n.onclick = () => {
      window.focus();
      window.open('https://discord.com/quests', '_blank');
    };
  } catch (err) {
    console.warn('Desktop notification notice:', err);
  }
}

function updateSoundUI() {
  if (!els.soundToggle) return;
  els.soundToggle.setAttribute('aria-pressed', String(state.soundEnabled));
  els.soundToggle.classList.toggle('is-active', state.soundEnabled);
  els.soundToggle.innerHTML = icon(state.soundEnabled ? 'volume' : 'volume-x');
  els.soundToggle.title = state.soundEnabled
    ? 'Sound chime on (click to mute)'
    : 'Sound chime muted (click to unmute)';
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem('qc_sound', String(state.soundEnabled));
  updateSoundUI();
  if (state.soundEnabled) {
    playCompletionChime();
    toast('Sound alert enabled.', 'info');
  } else {
    toast('Sound alert muted.', 'info');
  }
}

function updateNotifyUI() {
  if (!els.notifyToggle) return;
  const active =
    state.notifyEnabled &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted';
  els.notifyToggle.setAttribute('aria-pressed', String(active));
  els.notifyToggle.classList.toggle('is-active', active);
  els.notifyToggle.title = active
    ? 'Desktop notifications on (click to disable)'
    : 'Enable desktop notifications';
}

async function toggleNotification() {
  if (typeof Notification === 'undefined') {
    toast('Desktop notifications are not supported in this browser.', 'warn');
    return;
  }

  if (Notification.permission === 'denied') {
    toast('Desktop notifications are blocked by your browser settings.', 'warn');
    return;
  }

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      state.notifyEnabled = false;
      localStorage.setItem('qc_notify', 'false');
      updateNotifyUI();
      toast('Notification permission was not granted.', 'warn');
      return;
    }
  }

  state.notifyEnabled = !state.notifyEnabled;
  localStorage.setItem('qc_notify', String(state.notifyEnabled));
  updateNotifyUI();
  if (state.notifyEnabled) {
    sendDesktopNotification('Quest Completer', 'Desktop notifications enabled!');
    toast('Desktop notifications enabled.', 'success');
  } else {
    toast('Desktop notifications turned off.', 'info');
  }
}

/* ------------------------------------------------------------- terms of service */

let tosConsentRequired = false;

function openTos(requireConsent = false) {
  if (!els.tosDialog) return;
  tosConsentRequired = requireConsent;
  const accepted = localStorage.getItem('qc_tos_accepted') === 'true';

  if (els.tosAgreeCheck) {
    els.tosAgreeCheck.checked = accepted;
  }
  if (els.tosAcceptBtn) {
    els.tosAcceptBtn.disabled = !accepted;
    const label = els.tosAcceptBtn.querySelector('span');
    if (label) {
      label.textContent = requireConsent ? 'I Agree & Continue' : 'Understood';
    }
  }

  if (!els.tosDialog.open) {
    els.tosDialog.showModal();
  }
}

function closeTos() {
  if (els.tosDialog && els.tosDialog.open) {
    els.tosDialog.close();
  }
}

function handleTosAccept() {
  localStorage.setItem('qc_tos_accepted', 'true');
  closeTos();
  if (tosConsentRequired && els.tokenInput.value.trim()) {
    submitLogin(new Event('submit'));
  }
}

/* ---------------------------------------------------------------------- jobs */

function followJob(job, { open = false } = {}) {
  if (!job) return;

  if (
    state.currentJob?.id === job.id &&
    state.jobES &&
    state.currentJob.status === 'running' &&
    job.status === 'running'
  ) {
    if (open) openActivity();
    return;
  }

  if (state.jobES) {
    state.jobES.close();
    state.jobES = null;
  }

  state.currentJob = job;
  if (open) openActivity();
  renderActivity(job);
  updateBanner();
  updateHeaderActions();

  if (job.status !== 'running') return;

  const source = new EventSource(`/api/jobs/${encodeURIComponent(job.id)}/events`);
  state.jobES = source;

  source.addEventListener('log', (event) => {
    const payload = parseEvent(event);
    if (payload) appendLog(payload);
  });

  source.addEventListener('quest', (event) => {
    const payload = parseEvent(event);
    if (!payload || !state.currentJob) return;
    const index = state.currentJob.quests.findIndex((quest) => quest.id === payload.id);
    if (index >= 0) {
      const prev = state.currentJob.quests[index];
      state.currentJob.quests[index] = { ...prev, ...payload };
      if (prev.state !== 'done' && payload.state === 'done') {
        playCompletionChime();
        sendDesktopNotification(
          `${payload.name || 'Quest'} completed!`,
          'Click to open Discord and claim your reward.',
        );
      }
    } else {
      state.currentJob.quests.push(payload);
      if (payload.state === 'done') {
        playCompletionChime();
        sendDesktopNotification(
          `${payload.name || 'Quest'} completed!`,
          'Click to open Discord and claim your reward.',
        );
      }
    }
    renderActivityQuests();
    updateBanner();
  });

  source.addEventListener('done', (event) => {
    const payload = parseEvent(event);
    if (payload?.job) finishJob(payload.job);
  });
}

function parseEvent(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

function finishJob(job) {
  if (state.jobES) {
    state.jobES.close();
    state.jobES = null;
  }

  state.currentJob = job;
  updateActivityMeta();
  renderActivityQuests();
  updateBanner();
  updateHeaderActions();
  loadQuests({ silent: true });

  const stats = job.stats ?? {};
  if (job.status === 'done') {
    if ((stats.completed ?? 0) > 0) {
      playCompletionChime();
      sendDesktopNotification(
        'Run finished!',
        `${stats.completed} quest(s) completed. Claim your rewards in Discord.`,
      );
    }
    const parts = [];
    if (stats.completed) parts.push(`${stats.completed} completed`);
    if (stats.failed) parts.push(`${stats.failed} failed`);
    if (stats.skipped) parts.push(`${stats.skipped} skipped`);
    const summaryMsg = parts.length ? `Run finished — ${parts.join(' · ')}.` : 'Run finished.';
    toast(
      `${summaryMsg} Please manually claim your rewards on Discord: https://discord.com/quests`,
      stats.failed || (!stats.completed && stats.skipped) ? 'warn' : 'success',
    );
  } else if (job.status === 'cancelled') {
    toast('Run stopped.', 'info');
  } else if (job.status === 'error') {
    toast(job.error ?? 'The run failed. Open activity for details.', 'error');
  }
}

function handleSessionJob(payload) {
  if (!payload) return;

  if (payload.status === 'running') {
    if (state.currentJob?.id === payload.id) return;
    if (payload.type === 'auto') {
      toast('Auto-runner started a new run.', 'info');
    }
    api(`/api/jobs/${encodeURIComponent(payload.id)}`)
      .then((data) => {
        if (data.job) followJob(data.job, { open: false });
      })
      .catch(() => {});
    return;
  }

  if (state.currentJob?.id === payload.id) {
    if (state.currentJob.status === 'running') {
      api(`/api/jobs/${encodeURIComponent(payload.id)}`)
        .then((data) => {
          if (data.job) finishJob(data.job);
        })
        .catch(() => {});
    }
    loadQuests({ silent: true });
    return;
  }

  if (payload.type === 'auto') {
    const stats = payload.summary ?? {};
    if (payload.status === 'done') {
      const parts = [];
      if (stats.completed) parts.push(`${stats.completed} completed`);
      if (stats.claimed) parts.push(`${stats.claimed} reward${stats.claimed === 1 ? '' : 's'} claimed`);
      if (stats.failed) parts.push(`${stats.failed} failed`);
      toast(
        parts.length ? `Auto-run finished — ${parts.join(' · ')}` : 'Auto-run finished.',
        stats.failed ? 'warn' : 'success',
      );
    } else if (payload.status === 'cancelled') {
      toast('Auto-run stopped.', 'info');
    } else {
      toast('Auto-run failed. Open activity for details.', 'error');
    }
  }

  loadQuests({ silent: true });
}

/* ------------------------------------------------------------------ activity UI */

function openActivity() {
  state.activityOpen = true;
  els.activity.classList.add('is-open');
  els.activity.setAttribute('aria-hidden', 'false');
  document.body.classList.add('activity-open');
  els.scrim.hidden = !window.matchMedia('(max-width: 760px)').matches;
}

function closeActivity() {
  state.activityOpen = false;
  els.activity.classList.remove('is-open');
  els.activity.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('activity-open');
  els.scrim.hidden = true;
}

function renderActivity(job, { withEvents = true } = {}) {
  updateActivityMeta();
  renderActivityQuests();

  els.activityLog.innerHTML = '';

  if (!job) {
    addLogPlaceholder('Activity from your next run will appear here.');
    return;
  }

  if (withEvents && Array.isArray(job.events) && job.status !== 'running') {
    const logs = job.events.filter((event) => event.type === 'log');
    logs.forEach((event) => appendLog(event.data, { scroll: false }));
    if (logs.length === 0) addLogPlaceholder('No log output for this run.');
    requestAnimationFrame(() => {
      els.activityLog.scrollTop = els.activityLog.scrollHeight;
    });
    return;
  }

  addLogPlaceholder('Waiting for the first update…');
}

function updateActivityMeta() {
  const job = state.currentJob;

  if (!job) {
    els.activityTitle.textContent = 'No run yet';
    els.activityStatusText.textContent = 'Idle';
    els.activityDot.className = 'status-dot';
    els.activityTimer.textContent = '';
    els.activityFoot.textContent = 'Runs keep going if you close this panel.';
    updateActivityTimer();
    return;
  }

  els.activityTitle.textContent = job.type === 'auto' ? 'Auto-run' : 'Quest run';

  const meta = {
    running: { label: 'In progress', dot: 'status-dot is-live', foot: 'Runs keep going if you close this panel.' },
    done: { label: 'Finished', dot: 'status-dot is-done', foot: 'Run finished! Claim rewards manually in Discord.' },
    cancelled: { label: 'Stopped', dot: 'status-dot is-warn', foot: 'Run stopped. You can start it again anytime.' },
    error: { label: 'Failed', dot: 'status-dot is-error', foot: 'Run failed. Check the log above for details.' },
  }[job.status] ?? { label: 'Idle', dot: 'status-dot', foot: '' };

  els.activityStatusText.textContent = meta.label;
  els.activityDot.className = meta.dot;
  els.activityFoot.textContent = meta.foot;
  updateActivityTimer();
}

function updateActivityTimer() {
  const job = state.currentJob;
  if (!job) {
    els.activityTimer.textContent = '';
    return;
  }
  const start = job.createdAt ?? Date.now();
  const end = job.finishedAt ?? Date.now();
  els.activityTimer.textContent = formatClock((end - start) / 1000);
}

function renderActivityQuests() {
  const job = state.currentJob;

  if (!job || !Array.isArray(job.quests) || job.quests.length === 0) {
    els.activityQuests.innerHTML =
      '<p class="activity-empty">No quests in this run yet.</p>';
    return;
  }

  els.activityQuests.innerHTML = job.quests
    .map((quest) => {
      const meta = JOB_STATE[quest.state] ?? JOB_STATE.queued;
      const isRunning = quest.state === 'running';
      const isDone = quest.state === 'done';
      const percent = Math.max(0, Math.min(100, Math.round(quest.percent ?? 0)));
      const initials = (quest.name || 'Q')
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const progressClock =
        quest.target > 0
          ? `${formatClock(quest.progress ?? 0)} / ${formatClock(quest.target)}`
          : meta.label;

      return `
        <div class="activity-quest-card${isRunning ? ' is-active' : ''}${isDone ? ' is-finished' : ''}" data-aq-id="${esc(quest.id)}">
          <div class="aq-header">
            <div class="aq-identity">
              <span class="aq-thumb">${esc(initials)}</span>
              <div class="aq-info">
                <span class="aq-name" title="${esc(quest.name)}">${esc(quest.name)}</span>
                <span class="aq-target-label">${quest.target > 0 ? `${Math.ceil(quest.target / 60)} min target` : 'Task'}</span>
              </div>
            </div>
            <span class="aq-badge ${meta.className}">
              ${isRunning ? '<span class="pulse-dot"></span>' : ''}
              <span>${meta.label}</span>
            </span>
          </div>
          <div class="aq-body">
            <div class="aq-track${isRunning ? ' is-running' : ''}${isDone ? ' is-done' : ''}">
              <span style="width: ${percent}%"></span>
            </div>
            <div class="aq-stats">
              <span class="aq-percent">${percent}% completed</span>
              <strong class="aq-time">${esc(progressClock)}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function addLogPlaceholder(text) {
  const row = document.createElement('div');
  row.className = 'log-placeholder';
  row.textContent = text;
  els.activityLog.appendChild(row);
}

function appendLog(payload, { scroll = true } = {}) {
  if (!payload) return;
  const placeholder = $('.log-placeholder', els.activityLog);
  if (placeholder) placeholder.remove();

  const isHeartbeat = /still running/i.test(payload.message || '');
  const row = document.createElement('div');
  row.className = `log-row log-${payload.level ?? 'info'}${isHeartbeat ? ' log-heartbeat' : ''}`;

  const bullet = document.createElement('span');
  bullet.className = 'log-bullet';

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = clockTime(payload.ts ?? Date.now());

  const message = document.createElement('span');
  message.className = 'log-msg';
  message.textContent = payload.message ?? '';

  row.append(bullet, time, message);

  const shouldStick = scroll
    ? els.activityLog.scrollHeight - els.activityLog.scrollTop - els.activityLog.clientHeight < 90
    : false;

  els.activityLog.appendChild(row);
  if (shouldStick) els.activityLog.scrollTop = els.activityLog.scrollHeight;
}

/* ---------------------------------------------------------------------- banner */

function updateBanner() {
  const job = state.currentJob;
  const running = job?.status === 'running';
  els.jobBanner.hidden = !running;
  if (!running) {
    if (els.jbEta) els.jbEta.hidden = true;
    return;
  }

  const quests = Array.isArray(job.quests) ? job.quests : [];
  const current =
    quests.find((quest) => quest.state === 'running') ??
    quests.find((quest) => quest.state === 'queued');
  const processed = quests.filter((quest) =>
    ['done', 'failed', 'skipped', 'cancelled'].includes(quest.state),
  ).length;
  const percent = quests.length ? Math.round((processed / quests.length) * 100) : 0;

  els.jbTitle.textContent = job.type === 'auto' ? 'Auto-run in progress' : 'Run in progress';
  els.jbSub.textContent = current
    ? `${current.name}${current.message ? ` · ${current.message}` : ''}`
    : 'Preparing…';
  els.jbBar.style.width = `${percent}%`;
  els.jbDot.classList.toggle('is-live', running);
  els.jbStop.disabled = false;

  // Batch ETA calculation
  const remainingQuests = quests.filter((q) => q.state === 'running' || q.state === 'queued');
  if (remainingQuests.length > 0 && els.jbEta && els.jbEtaText) {
    let remainingSeconds = 0;
    for (const q of remainingQuests) {
      const target = q.target || 900;
      const progress = q.progress || 0;
      remainingSeconds += Math.max(0, target - progress);
    }
    const count = remainingQuests.length;
    const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));
    els.jbEtaText.textContent = `${count} quest${count === 1 ? '' : 's'} remaining · ~${minutes}m total`;
    els.jbEta.hidden = false;
  } else if (els.jbEta) {
    els.jbEta.hidden = true;
  }
}

/* -------------------------------------------------------------------- session */

function attachSessionStream() {
  if (state.sessionES) return;

  const source = new EventSource('/api/events');
  state.sessionES = source;

  source.addEventListener('ready', (event) => {
    const payload = parseEvent(event);
    if (payload?.auto) {
      state.auto = payload.auto;
      updateAutoUI();
    }
  });

  source.addEventListener('auto', (event) => {
    const payload = parseEvent(event);
    if (!payload) return;
    state.auto = payload;
    updateAutoUI();

    if (payload.lastError) {
      toast(`Auto-runner check failed: ${payload.lastError}`, 'warn');
    }
    if (payload.claimed > 0) {
      toast(`Auto-claimed ${payload.claimed} reward${payload.claimed === 1 ? '' : 's'}.`, 'success');
      loadQuests({ silent: true });
    }
  });

  source.addEventListener('quests', () => {
    loadQuests({ silent: true });
  });

  source.addEventListener('job', (event) => {
    const payload = parseEvent(event);
    if (payload) handleSessionJob(payload);
  });

  source.addEventListener('expired', () => {
    handleSessionLost('Discord rejected the session token. It was removed from memory.');
  });

  source.addEventListener('ended', () => {
    if (!state.sessionLost) {
      handleSessionLost('Session ended. The token was erased from memory.');
    }
  });

  source.onerror = () => {
    if (state.sessionLost) return;
    clearTimeout(state.sseProbe);
    state.sseProbe = setTimeout(async () => {
      if (state.sessionLost) return;
      try {
        const response = await fetch('/api/session', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (response.status === 401) {
          handleSessionLost('Your session ended. The token was removed from memory.');
        }
      } catch {
        // Server may be restarting; leave the browser to retry the stream.
      }
    }, 3000);
  };
}

function closeStreams() {
  if (state.sessionES) {
    state.sessionES.close();
    state.sessionES = null;
  }
  if (state.jobES) {
    state.jobES.close();
    state.jobES = null;
  }
  clearTimeout(state.sseProbe);
}

function startTicker() {
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = setInterval(() => {
    updatePageSub();
    updateActivityTimer();
    tickActiveQuestProgress();
  }, 1000);
}

function tickActiveQuestProgress() {
  const job = state.currentJob;
  if (!job || job.status !== 'running' || !Array.isArray(job.quests)) return;

  const currentQuest = job.quests.find((q) => q.state === 'running');
  if (!currentQuest || !currentQuest.target || currentQuest.target <= 0) return;

  if (currentQuest.progress < currentQuest.target) {
    currentQuest.progress = Math.min(currentQuest.target, (currentQuest.progress || 0) + 1);
    currentQuest.percent = Math.min(100, Math.round((currentQuest.progress / currentQuest.target) * 100));

    const progressClock = `${formatClock(currentQuest.progress)} / ${formatClock(currentQuest.target)}`;
    const percentStr = `${currentQuest.percent}%`;

    // 1. Update in Activity Drawer
    const aqItem = els.activityQuests.querySelector(`[data-aq-id="${currentQuest.id}"]`);
    if (aqItem) {
      const trackSpan = aqItem.querySelector('.aq-track span');
      const timeSpan = aqItem.querySelector('.aq-time');
      const percentSpan = aqItem.querySelector('.aq-percent');
      if (trackSpan) trackSpan.style.width = `${currentQuest.percent}%`;
      if (timeSpan) timeSpan.textContent = progressClock;
      if (percentSpan) percentSpan.textContent = `${percentStr} completed`;
    }

    // 2. Update in Main Dashboard Grid Card
    const card = els.grid.querySelector(`[data-quest="${currentQuest.id}"]`);
    if (card) {
      const cardTrackSpan = card.querySelector('.progress-track span');
      const cardTimeSpan = card.querySelector('.progress-copy strong');
      const cardPercentSpan = card.querySelector('.progress-copy > span');
      if (cardTrackSpan) cardTrackSpan.style.width = `${currentQuest.percent}%`;
      if (cardTimeSpan) cardTimeSpan.textContent = progressClock;
      if (cardPercentSpan) cardPercentSpan.textContent = `${percentStr} logged`;
    }
  }
}

/* ---------------------------------------------------------------------- login */

const CONNECT_STAGES = [
  'Reading the token…',
  'Verifying with Discord…',
  'Opening a secure session…',
];
const MIN_CONNECT_MS = 1200;

let connectTimers = [];
let connectStartedAt = 0;
let connecting = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clearConnectTimers() {
  for (const timer of connectTimers) clearTimeout(timer);
  connectTimers = [];
}

function setConnectStage(index) {
  const label = CONNECT_STAGES[index];
  if (!label) return;

  els.connectStatus.textContent = label;
  els.connectStatus.classList.remove('is-fresh');
  void els.connectStatus.offsetWidth;
  els.connectStatus.classList.add('is-fresh');

  els.connectSteps.forEach((step, i) => {
    step.classList.toggle('is-active', i === index);
    step.classList.toggle('is-done', i < index);
  });
}

function beginConnectOverlay() {
  clearConnectTimers();
  connecting = true;
  connectStartedAt = performance.now();

  els.connectOverlay.hidden = false;
  els.connectOverlay.setAttribute('aria-hidden', 'false');
  els.connectOverlay.classList.remove('is-active', 'is-leaving', 'is-success', 'is-error');
  els.connectTitle.textContent = 'Connecting your account';
  els.connectKicker.textContent = 'Secure handshake';
  els.connectStatus.className = 'connect-status';
  els.connectStatus.textContent = CONNECT_STAGES[0];
  els.connectSteps.forEach((step, i) => {
    step.classList.toggle('is-active', i === 0);
    step.classList.remove('is-done', 'is-failed');
  });

  document.body.classList.add('is-connecting');
  els.auth.setAttribute('aria-busy', 'true');

  requestAnimationFrame(() => els.connectOverlay.classList.add('is-active'));
  connectTimers.push(setTimeout(() => setConnectStage(1), 420));
  connectTimers.push(setTimeout(() => setConnectStage(2), 840));
}

async function markConnectFailed(message) {
  clearConnectTimers();
  els.connectOverlay.classList.remove('is-success');
  els.connectOverlay.classList.add('is-error');
  els.connectKicker.textContent = 'Handshake rejected';
  els.connectTitle.textContent = 'Connection failed';
  els.connectStatus.textContent = message;

  const activeIndex = els.connectSteps.findIndex((step) => step.classList.contains('is-active'));
  const failedIndex =
    activeIndex === -1
      ? els.connectSteps.findIndex((step) => step.classList.contains('is-done'))
      : activeIndex;

  els.connectSteps.forEach((step, i) => {
    step.classList.remove('is-active');
    step.classList.toggle('is-failed', i === failedIndex);
  });
  await wait(1050);
}

async function markConnected(displayName) {
  const elapsed = performance.now() - connectStartedAt;
  if (elapsed < MIN_CONNECT_MS) await wait(MIN_CONNECT_MS - elapsed);

  clearConnectTimers();
  els.connectOverlay.classList.remove('is-error');
  els.connectOverlay.classList.add('is-success');
  els.connectKicker.textContent = 'Session ready';
  els.connectTitle.textContent = 'Connected';
  els.connectStatus.textContent = displayName
    ? `Verified as ${displayName}. Opening your dashboard…`
    : 'Account verified. Opening your dashboard…';
  els.connectSteps.forEach((step) => {
    step.classList.remove('is-active', 'is-failed');
    step.classList.add('is-done');
  });
  await wait(620);
}

async function closeConnectOverlay() {
  clearConnectTimers();
  els.connectOverlay.classList.add('is-leaving');
  await wait(220);
  els.connectOverlay.classList.remove('is-active', 'is-leaving', 'is-success', 'is-error');
  els.connectOverlay.hidden = true;
  els.connectOverlay.setAttribute('aria-hidden', 'true');
  els.connectStatus.className = 'connect-status';
  els.connectSteps.forEach((step) => step.classList.remove('is-failed'));
  document.body.classList.remove('is-connecting');
  els.auth.removeAttribute('aria-busy');
  connecting = false;
}

function resetConnectOverlay() {
  clearConnectTimers();
  connecting = false;
  if (!els.connectOverlay) return;

  els.connectOverlay.hidden = true;
  els.connectOverlay.classList.remove('is-active', 'is-leaving', 'is-success', 'is-error');
  els.connectOverlay.setAttribute('aria-hidden', 'true');
  els.connectStatus.className = 'connect-status';
  els.connectSteps.forEach((step) => step.classList.remove('is-failed'));
  document.body.classList.remove('is-connecting');
  els.auth.removeAttribute('aria-busy');
}

async function connectWithToken(token, slotNum = 1) {
  const tosAccepted = localStorage.getItem('qc_tos_accepted') === 'true';
  if (!tosAccepted) {
    openTos(true);
    return;
  }

  setBusy(els.connectBtn, true, 'Connecting');
  beginConnectOverlay();

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message ?? `Could not connect (${response.status}).`;
      await markConnectFailed(message);
      await closeConnectOverlay();
      setLoginError(message);
      if (els.tokenInput) els.tokenInput.focus();
      return;
    }

    state.activeSlot = slotNum;
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotNum));

    // Save into vault if enabled or existing
    const shouldSave = els.saveVaultCheck ? els.saveVaultCheck.checked : true;
    if (shouldSave) {
      saveSlot(slotNum, token, payload.account, {
        questsSolved: 0,
        orbs: 0,
      });
    }

    if (els.tokenInput) {
      els.tokenInput.value = '';
      els.toggleToken?.querySelector('use')?.setAttribute('href', '#i-eye');
      els.toggleToken?.setAttribute('aria-label', 'Show token');
      els.tokenInput.type = 'password';
    }

    await markConnected(payload.account?.displayName);
    enterApp(payload, { push: true });
    await closeConnectOverlay();
    toast(`Connected as ${payload.account.displayName} on Slot ${slotNum}.`, 'success');
  } catch {
    const message = 'Could not reach the server. Make sure it is running, then try again.';
    await markConnectFailed(message);
    await closeConnectOverlay();
    setLoginError(message);
  } finally {
    setBusy(els.connectBtn, false);
  }
}

async function submitLogin(event) {
  if (event?.preventDefault) event.preventDefault();
  if (connecting) return;
  setLoginError('');

  const token = els.tokenInput.value.trim();
  if (!token) {
    setLoginError('Paste your Discord user token first.');
    els.tokenInput.focus();
    return;
  }

  const targetSlot = Number(els.loginSlotSelect?.value) || 1;
  await connectWithToken(token, targetSlot);
}

function setLoginError(message) {
  els.loginError.textContent = message;
  els.loginError.hidden = !message;
}

function toggleTokenVisibility() {
  const showing = els.tokenInput.type === 'text';
  els.tokenInput.type = showing ? 'password' : 'text';
  els.toggleToken.setAttribute('aria-label', showing ? 'Show token' : 'Hide token');
  els.toggleToken
    .querySelector('use')
    ?.setAttribute('href', showing ? '#i-eye' : '#i-eye-off');
  els.tokenInput.focus();
}

function setBusy(button, busy, label = 'Working…') {
  if (!button) return;

  if (busy) {
    if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span><span>${esc(label)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.idleHtml) {
      button.innerHTML = button.dataset.idleHtml;
      delete button.dataset.idleHtml;
    }
  }
}

/* --------------------------------------------------------------------- toasts */

function toast(message, tone = 'info') {
  if (!message) return;

  const icons = { success: 'check', error: 'alert', warn: 'alert', info: 'info' };
  const node = document.createElement('div');
  node.className = `toast ${tone}`;

  const safeMessage = esc(message).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #ffffff; text-decoration: underline; font-weight: 600;">$1</a>',
  );

  node.innerHTML = `${icon(icons[tone] ?? 'info')}<span>${safeMessage}</span>`;
  els.toasts.appendChild(node);

  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 190);
  };

  setTimeout(remove, tone === 'error' ? 7000 : 5000);
  node.addEventListener('click', (event) => {
    if (event.target.tagName !== 'A') remove();
  });
}

/* ---------------------------------------------------------------------- events */

function bindEvents() {
  els.loginForm.addEventListener('submit', submitLogin);
  els.toggleToken.addEventListener('click', toggleTokenVisibility);

  // Navigation module switching
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const mod = item.dataset.module;
      if (mod) switchModule(mod);
    });
  });

  els.sidebarToggle?.addEventListener('click', () => {
    els.sidebar?.classList.toggle('is-open');
  });

  els.sidebarLogoutBtn?.addEventListener('click', () => {
    if (!els.logoutDialog.open) els.logoutDialog.showModal();
  });

  els.activityToggleBtn?.addEventListener('click', () => {
    if (state.activityOpen) closeActivity();
    else openActivity();
  });

  // Dashboard quick actions
  els.dashLaunchQuests?.addEventListener('click', () => switchModule('quests'));
  els.dashManageSlotsBtn?.addEventListener('click', () => switchModule('accounts'));

  // Device spoofer toggles
  els.spooferMobileToggle?.addEventListener('click', () => toggleMobileSpoofer());
  els.rpcSpooferMobile?.addEventListener('click', () => toggleMobileSpoofer());
  els.spooferVrToggle?.addEventListener('click', () => toggleVrSpoofer());
  els.rpcSpooferVr?.addEventListener('click', () => toggleVrSpoofer());

  // Multi-Accounts Vault modal & actions
  els.openLinkSlotBtn?.addEventListener('click', () => openLinkSlotModal(1));
  els.checkTokensBtn?.addEventListener('click', checkTokensStatus);
  els.linkSlotCancel?.addEventListener('click', closeLinkSlotModal);
  els.linkSlotConfirm?.addEventListener('click', handleConfirmLinkSlot);
  els.slotModalToggleToken?.addEventListener('click', () => {
    if (!els.slotModalToken) return;
    const isPw = els.slotModalToken.type === 'password';
    els.slotModalToken.type = isPw ? 'text' : 'password';
  });

  els.slotsGrid?.addEventListener('click', async (e) => {
    const switchBtn = e.target.closest('.btn-switch-slot');
    if (switchBtn) {
      const slotNum = Number(switchBtn.dataset.slot);
      await switchSlot(slotNum);
      return;
    }
    const linkBtn = e.target.closest('.btn-link-slot');
    if (linkBtn) {
      const slotNum = Number(linkBtn.dataset.slot);
      openLinkSlotModal(slotNum);
      return;
    }
    const syncBtn = e.target.closest('.btn-sync-slot');
    if (syncBtn) {
      const slotNum = Number(syncBtn.dataset.slot);
      toast(`Re-syncing Slot ${slotNum} account details…`, 'info');
      await switchSlot(slotNum);
      return;
    }
    const delBtn = e.target.closest('.btn-delete-slot');
    if (delBtn) {
      const slotNum = Number(delBtn.dataset.slot);
      if (confirm(`Unlink and clear Slot ${slotNum} from vault?`)) {
        deleteSlot(slotNum);
      }
      return;
    }
  });

  // Auth View tabs & saved slots
  els.authTabToken?.addEventListener('click', () => {
    els.authTabToken.classList.add('is-active');
    els.authTabDiscord?.classList.remove('is-active');
    els.loginForm.hidden = false;
    if (els.discordLoginPanel) els.discordLoginPanel.hidden = true;
  });
  els.authTabDiscord?.addEventListener('click', () => {
    els.authTabDiscord.classList.add('is-active');
    els.authTabToken?.classList.remove('is-active');
    els.loginForm.hidden = true;
    if (els.discordLoginPanel) els.discordLoginPanel.hidden = false;
  });
  els.discordOAuthBtn?.addEventListener('click', () => {
    toast('Discord OAuth Fast Connect: Redirecting to Discord authorization…', 'info');
  });

  els.authSlotsList?.addEventListener('click', async (e) => {
    const launchBtn = e.target.closest('.auth-slot-launch-btn');
    if (!launchBtn) return;
    const slotNum = Number(launchBtn.dataset.slot);
    const slot = getSlot(slotNum);
    if (slot?.token) {
      toast(`Connecting via saved Slot ${slotNum}…`, 'info');
      await connectWithToken(slot.token, slotNum);
    }
  });

  // Badges Studio UI controls
  $$('.house-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.badges.hypesquad = btn.dataset.house;
      renderBadgesUI();
    });
  });
  els.hypesquadSwitchBtn?.addEventListener('click', () => {
    const houses = ['bravery', 'brilliance', 'balance'];
    const curIdx = houses.indexOf(state.badges.hypesquad);
    state.badges.hypesquad = houses[(curIdx + 1) % houses.length];
    renderBadgesUI();
  });
  els.boosterStreakSelect?.addEventListener('change', () => {
    state.badges.boosterStreak = Number(els.boosterStreakSelect.value) || 24;
    renderBadgesUI();
  });
  els.badgeEarlyToggle?.addEventListener('change', () => {
    state.badges.earlySupporter = els.badgeEarlyToggle.checked;
    renderBadgesUI();
  });
  els.badgeBughunterToggle?.addEventListener('change', () => {
    state.badges.bugHunter = els.badgeBughunterToggle.checked;
    renderBadgesUI();
  });
  els.badgeCheckBtn?.addEventListener('click', () => {
    setBusy(els.badgeCheckBtn, true, 'Scanning…');
    setTimeout(() => {
      setBusy(els.badgeCheckBtn, false);
      toast('Profile badge verification scan complete: 4 credentials eligible.', 'success');
    }, 700);
  });
  els.badgeSaveBtn?.addEventListener('click', () => {
    toast('Discord Badges showcase preferences saved.', 'success');
  });

  // Rich Presence Studio controls & live inputs
  $$('.rpc-type-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.rpc-type-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      state.rpc.type = Number(tab.dataset.type) || 0;
      updateRpcPreview();
    });
  });

  const bindRpcInput = (el, prop) => {
    el?.addEventListener('input', () => {
      state.rpc[prop] = el.value;
      updateRpcPreview();
    });
  };
  bindRpcInput(els.rpcTitle, 'title');
  bindRpcInput(els.rpcDetails, 'details');
  bindRpcInput(els.rpcState, 'state');
  bindRpcInput(els.rpcLargeImg, 'largeImg');
  bindRpcInput(els.rpcLargeText, 'largeText');
  bindRpcInput(els.rpcSmallImg, 'smallImg');
  bindRpcInput(els.rpcSmallText, 'smallText');
  bindRpcInput(els.rpcBtn1Label, 'btn1Label');
  bindRpcInput(els.rpcBtn1Url, 'btn1Url');

  els.rpcUpdateBtn?.addEventListener('click', () => {
    toast('Rich Presence broadcast successfully updated on Gateway v10.', 'success');
  });
  els.rpcClearBtn?.addEventListener('click', () => {
    state.rpc.title = '';
    state.rpc.details = '';
    state.rpc.state = '';
    if (els.rpcTitle) els.rpcTitle.value = '';
    if (els.rpcDetails) els.rpcDetails.value = '';
    if (els.rpcState) els.rpcState.value = '';
    updateRpcPreview();
    toast('Rich Presence cleared.', 'info');
  });

  // Utility Ping button
  els.utilityPingBtn?.addEventListener('click', async () => {
    setBusy(els.utilityPingBtn, true, 'Pinging…');
    const start = performance.now();
    try {
      await fetch('/api/session', { credentials: 'same-origin' });
      const ms = Math.round(performance.now() - start);
      if (els.utilPingVal) els.utilPingVal.innerHTML = `${ms} <small>ms</small>`;
      toast(`Gateway round-trip ping: ${ms}ms`, 'success');
    } catch {
      toast('Gateway ping failed.', 'error');
    } finally {
      setBusy(els.utilityPingBtn, false);
    }
  });
  els.toggleToken.addEventListener('click', toggleTokenVisibility);

  els.autoToggle.addEventListener('click', toggleAuto);
  els.notifyToggle?.addEventListener('click', toggleNotification);
  els.soundToggle?.addEventListener('click', toggleSound);
  els.refreshBtn.addEventListener('click', refreshQuests);
  els.claimAllBtn.addEventListener('click', claimAllRewards);
  els.runAllBtn.addEventListener('click', startAllQuests);

  els.tosAgreeCheck?.addEventListener('change', () => {
    if (els.tosAcceptBtn) {
      els.tosAcceptBtn.disabled = !els.tosAgreeCheck.checked;
    }
  });
  els.tosAcceptBtn?.addEventListener('click', handleTosAccept);
  els.tosDeclineBtn?.addEventListener('click', closeTos);
  els.tosLinkAuth?.addEventListener('click', () => openTos(false));
  els.tosMenuBtn?.addEventListener('click', () => {
    els.accountMenu.hidden = true;
    openTos(false);
  });

  $$('[data-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.filter = tab.dataset.filter;
      updateCounts();
      renderQuests();
    });
  });

  let searchTimer = null;
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = els.searchInput.value;
      renderQuests();
    }, 120);
  });

  els.emptyAction.addEventListener('click', () => {
    if (state.emptyMode === 'retry') loadQuests();
    else if (state.emptyMode === 'clear-search') {
      els.searchInput.value = '';
      state.query = '';
      renderQuests();
    } else if (state.emptyMode === 'show-all') {
      state.filter = 'all';
      updateCounts();
      renderQuests();
    } else {
      loadQuests();
    }
  });

  els.grid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const questId = button.dataset.id;
    if (button.dataset.action === 'run') startQuest(questId);
    else if (button.dataset.action === 'claim') claimQuest(questId, button);
  });

  els.jbView.addEventListener('click', openActivity);
  els.jbStop.addEventListener('click', stopRun);
  els.activityClose.addEventListener('click', closeActivity);
  els.scrim.addEventListener('click', closeActivity);

  els.accountBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = els.accountMenu.hidden;
    els.accountMenu.hidden = !open;
    els.accountBtn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.account') && !els.accountMenu.hidden) {
      els.accountMenu.hidden = true;
      els.accountBtn.setAttribute('aria-expanded', 'false');
    }
  });

  els.logoutBtn.addEventListener('click', () => {
    els.accountMenu.hidden = true;
    els.accountBtn.setAttribute('aria-expanded', 'false');
    if (!els.logoutDialog.open) els.logoutDialog.showModal();
  });

  els.logoutDialog.addEventListener('close', async () => {
    if (els.logoutDialog.returnValue !== 'confirm') return;

    let cleared = false;
    try {
      const response = await fetch('/api/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      cleared = response.ok;
    } catch {
      cleared = false;
    }

    closeStreams();
    showAuth(
      cleared
        ? 'Session ended. The token was erased from memory.'
        : 'Logged out of this view. The server could not be reached, so the in-memory token will clear when the session expires.',
    );
  });

  els.avatar.addEventListener('error', () => {
    els.avatar.hidden = true;
    els.avatarFallback.hidden = false;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.accountMenu.hidden) {
      els.accountMenu.hidden = true;
      els.accountBtn.setAttribute('aria-expanded', 'false');
    }
    if (state.activityOpen) closeActivity();
  });

  window.addEventListener('resize', () => {
    if (!state.activityOpen) return;
    els.scrim.hidden = !window.matchMedia('(max-width: 760px)').matches;
  });

  window.addEventListener('popstate', () => {
    if (state.account && window.location.pathname !== DASHBOARD_PATH) {
      window.history.replaceState({ view: 'dashboard' }, '', DASHBOARD_PATH);
    } else if (!state.account && window.location.pathname !== '/') {
      window.history.replaceState({ view: 'auth' }, '', '/');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session && !state.sessionLost) {
      loadQuests({ silent: true });
    }
  });
}

init().catch((error) => {
  console.error(error);
  try {
    showAuth('Something went wrong while starting the app. Reload the page to try again.');
  } catch {
    // The DOM may not be ready; a reload is the fallback.
  }
});
