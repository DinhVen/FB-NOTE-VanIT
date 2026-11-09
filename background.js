// FB NOTE - VanIT — background service worker
// Every Facebook request is executed inside a facebook.com tab (same-origin,
// uses the user's own session). Request formats / doc_ids are unchanged from v1.

const HISTORY_KEY = "historyV1";
const SCHEDULES_KEY = "schedulesV1";
const REPOST_KEY = "autoRepostV1";
const HISTORY_LIMIT = 50;
const MIN_REPOST_DURATION = 60 * 60; // seconds — protects the account from spammy reposting
const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRIES = 6;

class FbError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------
const sanitizeToken = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length < 6 || trimmed.length > 300) return "";
  if (!/^[A-Za-z0-9:_\-]+$/.test(trimmed)) return "";
  return trimmed;
};

const extractTokens = (cookie, html) => {
  const userId = (/c_user=(\d+)/.exec(cookie) || [])[1] || "";
  const fb_dtsg = sanitizeToken((/"DTSG(?:Initia|Init)l?Data",\[],\{"token":"([^"\\]{8,300})"/m.exec(html) || [])[1]);
  let lsdMatch = /name="lsd" value="([^"\\]{6,300})"/m.exec(html) || /"LSD",\[],\{"token":"([^"\\]{6,300})"/m.exec(html);
  const lsd = sanitizeToken(lsdMatch ? lsdMatch[1] : "");
  if (!userId || !fb_dtsg) return null;
  let sum = 0;
  for (let i = 0; i < fb_dtsg.length; i++) sum += fb_dtsg.charCodeAt(i);
  return { userId, fb_dtsg, jazoest: "2" + sum, lsd };
};

// ---------------------------------------------------------------------------
// Functions injected into the Facebook tab (must be fully self-contained)
// ---------------------------------------------------------------------------
function pageGetInfo() {
  return { cookie: document.cookie, html: document.documentElement.innerHTML };
}

async function pageGraphQL(tokens, friendlyName, docId, variables) {
  const extract = (source, regex) => (regex.exec(source) || [])[1] || "";
  const html = document.documentElement.outerHTML;
  const spinR = extract(html, /"__spin_r":(\d+)/);
  const spinB = extract(html, /"__spin_b":"([^"]+)"/);
  const spinT = extract(html, /"__spin_t":(\d+)/);
  const rev = extract(html, /"client_revision":(\d+)/);
  const hsi = extract(html, /"hsi":"(\d+)"/);
  const ccg = extract(html, /"__ccg":"([^"]+)"/);
  const cometReq = extract(html, /"__comet_req":"?([^",}]+)"?/);

  const body = new URLSearchParams();
  body.append("av", tokens.userId);
  body.append("__user", tokens.userId);
  body.append("__a", "1");
  body.append("__comet_req", cometReq || "15");
  if (ccg) body.append("__ccg", ccg);
  body.append("dpr", String(self.devicePixelRatio || 1));
  body.append("fb_dtsg", tokens.fb_dtsg);
  body.append("jazoest", tokens.jazoest);
  if (tokens.lsd) body.append("lsd", tokens.lsd);
  if (spinR) body.append("__spin_r", spinR);
  if (spinB) body.append("__spin_b", spinB);
  body.append("__spin_t", spinT || String(Math.floor(Date.now() / 1e3)));
  if (rev) body.append("__rev", rev);
  if (hsi) body.append("__hsi", hsi);
  body.append("fb_api_caller_class", "RelayModern");
  body.append("fb_api_req_friendly_name", friendlyName);
  body.append("server_timestamps", "true");
  body.append("variables", JSON.stringify(variables));
  body.append("doc_id", docId);

  try {
    const response = await fetch("/api/graphql/", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-FB-Friendly-Name": friendlyName,
      },
      body: body.toString(),
    });
    const text = (await response.text()).replace("for (;;);", "").trim();
    // Some queries stream several JSON objects separated by newlines; the first one holds `data`.
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      try {
        json = JSON.parse(text.split("\n")[0]);
      } catch {
        return { ok: false, error: "Invalid JSON response: " + text.slice(0, 200) };
      }
    }
    if (json && json.error) {
      const desc = json.errorDescription ? " - " + json.errorDescription : "";
      return { ok: false, error: (json.errorSummary || "GraphQL request failed") + desc + " (code: " + json.error + ")" };
    }
    if (json && Array.isArray(json.errors) && json.errors.length > 0) {
      return { ok: false, error: (json.errors[0] && json.errors[0].message) || "GraphQL error" };
    }
    return { ok: true, json };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : "Network error" };
  }
}

// ---------------------------------------------------------------------------
// Tab + session helpers
// ---------------------------------------------------------------------------
const FB_URL_RE = /^https?:\/\/([a-z0-9-]+\.)*facebook\.com\//i;
const tokenCache = new Map(); // tabId -> { tokens, at }
const TOKEN_TTL = 5 * 60 * 1000;

async function findFacebookTab() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active && active.url && FB_URL_RE.test(active.url) && !active.discarded) return active;
  const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
  return tabs.find((t) => !t.discarded && t.status === "complete") || tabs.find((t) => !t.discarded) || null;
}

async function runInTab(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  if (!results || !results[0]) throw new FbError("SCRIPT_FAILED", "Không chạy được script trong tab Facebook");
  return results[0].result;
}

async function getSession({ fresh = false } = {}) {
  const tab = await findFacebookTab();
  if (!tab) throw new FbError("NO_TAB", "Chưa mở tab Facebook");
  const cached = tokenCache.get(tab.id);
  if (!fresh && cached && Date.now() - cached.at < TOKEN_TTL) return { tabId: tab.id, tokens: cached.tokens };
  const info = await runInTab(tab.id, pageGetInfo);
  const tokens = info ? extractTokens(info.cookie, info.html) : null;
  if (!tokens) throw new FbError("NOT_LOGGED_IN", "Chưa đăng nhập Facebook");
  tokenCache.set(tab.id, { tokens, at: Date.now() });
  return { tabId: tab.id, tokens };
}

async function graphql(session, friendlyName, docId, variables) {
  return runInTab(session.tabId, pageGraphQL, [session.tokens, friendlyName, docId, variables]);
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------
async function fetchStatus(session) {
  const res = await graphql(session, "MWInboxTrayNoteCreationDialogQuery", "26067429279547490", { scale: 1 });
  if (!res.ok) return { success: false, error: res.error };
  const json = res.json;
  const actor = json?.data?.viewer?.actor;
  const status = actor?.msgr_user_rich_status;
  const isId = (v) => typeof v === "string" && /^[0-9]{5,30}$/.test(v);

  const findRichStatusIdDeep = (root) => {
    const seen = new Set();
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;
      seen.add(node);
      const candidate = node.rich_status_id ?? node.richStatusId;
      if (isId(candidate)) return candidate;
      if (isId(node.id) && (typeof node.__typename !== "string" || /rich|status/i.test(node.__typename))) return node.id;
      for (const value of Object.values(node)) if (value && typeof value === "object") stack.push(value);
    }
    return null;
  };

  const richStatusId = status
    ? isId(status.id) ? status.id : isId(status.rich_status_id) ? status.rich_status_id : findRichStatusIdDeep(status) || findRichStatusIdDeep(json?.data)
    : null;
  const musicMeta = status?.music_metadata;
  const licenseMusic = Array.isArray(musicMeta?.license_music) ? musicMeta.license_music[0] : null;
  const customAudience = Array.isArray(status?.custom_audience)
    ? status.custom_audience
    : Array.isArray(actor?.lightweight_status_custom_audience_list) ? actor.lightweight_status_custom_audience_list : [];

  return {
    success: true,
    status: {
      richStatusId,
      userName: typeof actor?.name === "string" ? actor.name : null,
      avatarUri: typeof actor?.profilePicture?.uri === "string" ? actor.profilePicture.uri : null,
      description: typeof status?.description === "string" ? status.description : null,
      noteType: typeof status?.note_type === "string" ? status.note_type : null,
      visibility: typeof status?.visibility === "string" ? status.visibility : null,
      expirationTime: typeof status?.expiration_time === "number" ? status.expiration_time : null,
      musicTitle: licenseMusic?.title?.text || musicMeta?.title || null,
      musicArtist: licenseMusic?.display_artist?.text || musicMeta?.artist_name || null,
      customAudienceNames: customAudience.map((i) => i?.short_name || i?.name).filter(Boolean),
      defaultAudienceSetting: typeof json?.data?.xfb_fetch_default_note_audience_setting === "string"
        ? json.data.xfb_fetch_default_note_audience_setting : null,
    },
  };
}

async function createNote(session, p) {
  const description = typeof p.description === "string" ? p.description.trim() : "";
  const music = p.selectedMusic && p.selectedMusic.id ? p.selectedMusic : null;
  const trimMs = Math.max(0, Math.floor((p.musicTrimStartMs || 0) / 1000) * 1000);
  const audience = p.audienceSetting || "FRIENDS";

  if (!description && !music) return { success: false, error: "Nội dung trống và chưa chọn nhạc" };
  const preferredCluster = music ? music.songId || music.audioClusterId || null : null;
  if (music && !preferredCluster) return { success: false, error: "Bài nhạc thiếu song ID, vui lòng chọn lại" };

  const privacy = ["PUBLIC", "FRIENDS", "CONTACTS", "CUSTOM"].includes(audience) ? audience : "CUSTOM";
  const mutationId = () => String((Date.now() % 9) + 1);
  const baseInput = {
    actor_id: session.tokens.userId,
    client_mutation_id: mutationId(),
    audience_list_type: null,
    description,
    duration: p.duration,
    note_type: "TEXT_NOTE",
    privacy,
    session_id: "",
  };

  if (audience === "CUSTOM") {
    const ids = Array.isArray(p.selectedFriendIds) ? p.selectedFriendIds : [];
    if (ids.length === 0) return { success: false, error: "Hãy chọn ít nhất 1 người bạn cho chế độ Tuỳ chỉnh" };
    const r = await graphql(session, "MWInboxTrayNoteCreationSelectorCustomParticipantsMutation", "23863727389920891", {
      input: { user_ids: ids, actor_id: session.tokens.userId, client_mutation_id: String(Date.now()) },
    });
    if (!r.ok) return { success: false, error: "Lưu danh sách bạn bè thất bại: " + r.error };
  }

  const candidates = [];
  if (music) {
    const clusters = [...new Set([preferredCluster, music.songId, music.audioClusterId].filter((v) => typeof v === "string" && v))];
    for (const cluster of clusters) {
      const types = description ? ["MUSIC_NOTE_WITH_TEXT", "MUSIC_NOTE"] : ["MUSIC_NOTE_MUSIC_ONLY", "MUSIC_NOTE"];
      types.forEach((type, i) => {
        candidates.push({
          ...baseInput,
          client_mutation_id: mutationId(),
          description: description ? description : i === 0 ? null : "",
          note_type: type,
          audio_cluster_id: cluster,
          song_start_time_ms: trimMs,
        });
      });
    }
  } else {
    candidates.push(baseInput);
  }

  const errors = [];
  let created = null;
  for (const input of candidates) {
    const r = await graphql(session, "useMWInboxTrayCreateNoteMutation", "25742693715382390", { input });
    if (r.ok) {
      created = r;
      break;
    }
    errors.push(r.error);
  }
  if (!created) {
    const detail = errors.slice(0, 3).join(" | ");
    return { success: false, error: (music ? "Tạo note nhạc thất bại. " : "Tạo note thất bại. ") + detail };
  }

  const data = created.json?.data;
  if (!data || typeof data !== "object") return { success: false, error: "GraphQL không trả về dữ liệu" };
  const hasPayload = Boolean(data.xfb_rich_status_create?.status?.id) || Object.entries(data).some(([k, v]) => {
    const key = k.toLowerCase();
    return (key.includes("createnote") || key.includes("inboxtray") || key.includes("rich_status")) && v != null;
  });
  if (!hasPayload) return { success: false, error: "Kết quả rỗng: " + JSON.stringify(data).slice(0, 200) };

  if (audience !== "DEFAULT" && audience !== "CUSTOM") {
    const r = await graphql(session, "MWInboxTrayNoteCreationAudienceSettingDialogPageMutation", "9845542138876958", {
      input: { actor_id: session.tokens.userId, client_mutation_id: String(Date.now()), new_audience_setting: audience },
    });
    if (!r.ok) return { success: false, error: "Đã tạo note nhưng cập nhật đối tượng thất bại: " + r.error };
  }
  return { success: true };
}

async function deleteNote(session, richStatusId) {
  const id = typeof richStatusId === "string" ? richStatusId.trim() : "";
  if (!/^[0-9]{5,30}$/.test(id)) return { success: false, error: "ID ghi chú không hợp lệ" };
  const r = await graphql(session, "useMWInboxTrayDeleteNoteMutation", "9532619970198958", {
    input: { actor_id: session.tokens.userId, client_mutation_id: String((Date.now() % 9) + 1), rich_status_id: id },
  });
  return r.ok ? { success: true } : { success: false, error: r.error };
}

async function searchFriends(session, query, cursor, count) {
  const isPage = Boolean(cursor);
  const name = isPage ? "StoriesCometPrivacySelectorFriendsBootstrapPaginationQuery" : "StoriesCometPrivacySelectorFriendsBootstrapViewQuery";
  const r = await graphql(session, name, isPage ? "30431034176487438" : "9876530802468059", {
    query: (query || "").normalize("NFC"),
    count: count || 20,
    cursor: cursor || null,
    id: session.tokens.userId,
  });
  if (!r.ok) return { success: false, error: r.error };
  const friends = r.json?.data?.user?.friends;
  const edges = Array.isArray(friends?.edges) ? friends.edges : [];
  const items = edges
    .map((e) => e?.node)
    .filter((n) => n && typeof n.id === "string" && typeof n.name === "string")
    .map((n) => ({ id: n.id, name: n.name, imageUri: typeof n?.photo?.uri === "string" ? n.photo.uri : undefined }));
  return {
    success: true,
    items,
    nextCursor: typeof friends?.page_info?.end_cursor === "string" ? friends.page_info.end_cursor : null,
    hasNextPage: Boolean(friends?.page_info?.has_next_page),
  };
}

async function searchMusic(session, query, count) {
  const safeCount = Math.max(1, Math.min(count || 80, 120));
  const r = await graphql(session, "useMWInboxTrayMusicNoteTypeaheadDataSourceQuery", "24439058322365411", {
    params: { first: safeCount, search_text: (query || "").normalize("NFC") },
    product: "FB_NOTES",
  });
  if (!r.ok) return { success: false, error: r.error };

  const toId = (v) => (typeof v === "string" && v ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
  const pickCluster = (i) => toId(i?.song_id) || toId(i?.audio_cluster_id) || toId(i?.audio_cluster?.id) ||
    toId(i?.audio_asset?.audio_cluster_id) || toId(i?.music_asset?.audio_cluster_id) || toId(i?.track?.audio_cluster_id) || toId(i?.cluster_id);
  const toItem = (i) => ({
    id: String(i?.display_id || i?.id || ""),
    songId: toId(i?.song_id),
    audioClusterId: pickCluster(i),
    title: String(i?.display_title?.text || ""),
    artist: String(i?.display_subtitle?.text || ""),
    imageUri: i?.display_image?.uri ? String(i.display_image.uri) : undefined,
    durationMs: typeof i?.duration_in_ms === "number" ? i.duration_in_ms : undefined,
    progressiveDownloadUrl: Array.isArray(i?.progressive_download) && i.progressive_download[0]?.url ? String(i.progressive_download[0].url) : undefined,
  });

  const items = [];
  const seen = new Set();
  const push = (raw) => {
    const item = toItem(raw);
    if (!item.id || !item.title || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };
  const edges = r.json?.data?.xfb_music_picker_connection_container?.items?.edges;
  if (Array.isArray(edges)) {
    for (const e of edges) for (const sub of e?.node?.sub_items || []) if (items.length < safeCount) push(sub);
  }
  if (items.length === 0) {
    const scan = (node) => {
      if (!node || typeof node !== "object" || items.length >= safeCount) return;
      if (node.__typename === "AudioAsset" || (node.display_id && node.display_title && node.display_subtitle)) push(node);
      for (const v of Object.values(node)) if (v && typeof v === "object") scan(v);
    };
    scan(r.json?.data);
  }
  return { success: true, items };
}

// ---------------------------------------------------------------------------
// History, scheduling, auto-repost
// ---------------------------------------------------------------------------
const storageGet = async (key, fallback) => (await chrome.storage.local.get(key))[key] ?? fallback;
const storageSet = (key, value) => chrome.storage.local.set({ [key]: value });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function addHistory(payload, source) {
  const list = await storageGet(HISTORY_KEY, []);
  list.unshift({ id: uid(), at: Date.now(), source, payload: { ...payload, autoRepost: undefined } });
  await storageSet(HISTORY_KEY, list.slice(0, HISTORY_LIMIT));
}

function notify(title, message) {
  try {
    chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message: message || "" });
  } catch {
    /* notifications are best-effort */
  }
}

async function setupAutoRepost(payload, times) {
  const count = Math.max(1, Math.min(Number(times) || 1, 10));
  const duration = Math.max(MIN_REPOST_DURATION, Number(payload.duration) || 0);
  const nextAt = Date.now() + duration * 1000 + 30 * 1000;
  await storageSet(REPOST_KEY, { payload: { ...payload, autoRepost: undefined }, remaining: count, nextAt, attempts: 0, lastError: null });
  await chrome.alarms.create("repost", { when: nextAt });
}

/** Single entry point for creating a note (popup, schedule or repost). */
async function performCreate(payload, source) {
  if (payload.autoRepost && (Number(payload.duration) || 0) < MIN_REPOST_DURATION) {
    return { success: false, error: "Tự đăng lại chỉ hỗ trợ thời hạn từ 1 giờ trở lên" };
  }
  const session = await getSession({ fresh: source !== "popup" });
  const result = await createNote(session, payload);
  if (!result.success) {
    tokenCache.delete(session.tabId);
    return result;
  }
  await addHistory(payload, source);
  if (payload.autoRepost && payload.autoRepost.times > 0) await setupAutoRepost(payload, payload.autoRepost.times);
  return result;
}

async function scheduleNote(at, payload) {
  const when = Number(at);
  if (!Number.isFinite(when) || when < Date.now() + 30 * 1000) return { success: false, error: "Thời gian hẹn phải sau hiện tại ít nhất 1 phút" };
  const list = await storageGet(SCHEDULES_KEY, []);
  const item = { id: uid(), at: when, createdAt: Date.now(), payload, status: "pending", attempts: 0, error: null };
  list.push(item);
  await storageSet(SCHEDULES_KEY, list);
  await chrome.alarms.create("sched:" + item.id, { when });
  return { success: true, id: item.id };
}

async function cancelSchedule(id) {
  const list = await storageGet(SCHEDULES_KEY, []);
  await storageSet(SCHEDULES_KEY, list.filter((s) => s.id !== id));
  await chrome.alarms.clear("sched:" + id);
  return { success: true };
}

async function runScheduled(id) {
  const list = await storageGet(SCHEDULES_KEY, []);
  const item = list.find((s) => s.id === id);
  if (!item || item.status !== "pending") return;
  let result;
  try {
    result = await performCreate(item.payload, "schedule");
  } catch (err) {
    result = { success: false, error: err.message, code: err.code };
  }
  const fresh = await storageGet(SCHEDULES_KEY, []);
  const target = fresh.find((s) => s.id === id);
  if (!target) return;
  if (result.success) {
    target.status = "done";
    target.doneAt = Date.now();
    notify("Đã đăng note theo lịch", item.payload?.meta?.text || "");
  } else if ((result.code === "NO_TAB" || result.code === "NOT_LOGGED_IN") && target.attempts < MAX_RETRIES) {
    target.attempts += 1;
    target.error = result.error + " — sẽ thử lại sau 5 phút";
    await chrome.alarms.create("sched:" + id, { when: Date.now() + RETRY_DELAY_MS });
  } else {
    target.status = "failed";
    target.error = result.error;
    notify("Đăng note theo lịch thất bại", result.error);
  }
  await storageSet(SCHEDULES_KEY, fresh);
}

async function runRepost() {
  const state = await storageGet(REPOST_KEY, null);
  if (!state || state.remaining <= 0) return;
  let result;
  try {
    result = await performCreate(state.payload, "repost");
  } catch (err) {
    result = { success: false, error: err.message, code: err.code };
  }
  if (result.success) {
    state.remaining -= 1;
    state.attempts = 0;
    state.lastError = null;
    notify("Đã tự động đăng lại note", state.remaining > 0 ? `Còn ${state.remaining} lần` : "Đã hết lượt tự đăng lại");
    if (state.remaining > 0) {
      state.nextAt = Date.now() + Math.max(MIN_REPOST_DURATION, state.payload.duration) * 1000 + 30 * 1000;
      await chrome.alarms.create("repost", { when: state.nextAt });
    } else {
      state.nextAt = null;
    }
  } else if (state.attempts < MAX_RETRIES) {
    state.attempts += 1;
    state.lastError = result.error;
    state.nextAt = Date.now() + RETRY_DELAY_MS;
    await chrome.alarms.create("repost", { when: state.nextAt });
  } else {
    state.remaining = 0;
    state.nextAt = null;
    state.lastError = result.error;
    notify("Tự đăng lại thất bại", result.error);
  }
  await storageSet(REPOST_KEY, state.remaining > 0 ? state : { ...state, remaining: 0 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("sched:")) runScheduled(alarm.name.slice(6));
  else if (alarm.name === "repost") runRepost();
});

// Re-create alarms that may have been lost (e.g. after an extension update).
async function reconcileAlarms() {
  const now = Date.now();
  const list = await storageGet(SCHEDULES_KEY, []);
  for (const s of list) {
    if (s.status !== "pending") continue;
    const existing = await chrome.alarms.get("sched:" + s.id);
    if (!existing) await chrome.alarms.create("sched:" + s.id, { when: Math.max(s.at, now + 5000) });
  }
  const repost = await storageGet(REPOST_KEY, null);
  if (repost && repost.remaining > 0 && repost.nextAt && !(await chrome.alarms.get("repost"))) {
    await chrome.alarms.create("repost", { when: Math.max(repost.nextAt, now + 5000) });
  }
}
chrome.runtime.onStartup.addListener(reconcileAlarms);
chrome.runtime.onInstalled.addListener(reconcileAlarms);

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
const handlers = {
  async GET_SESSION() {
    const s = await getSession({ fresh: true });
    return { success: true, userId: s.tokens.userId };
  },
  async GET_STATUS() {
    return fetchStatus(await getSession());
  },
  async CREATE_NOTE(msg) {
    return performCreate(msg.payload, "popup");
  },
  async DELETE_NOTE(msg) {
    return deleteNote(await getSession(), msg.richStatusId);
  },
  async SEARCH_MUSIC(msg) {
    return searchMusic(await getSession(), msg.query, msg.count);
  },
  async SEARCH_FRIENDS(msg) {
    return searchFriends(await getSession(), msg.query, msg.cursor, msg.count);
  },
  async SCHEDULE_NOTE(msg) {
    return scheduleNote(msg.at, msg.payload);
  },
  async CANCEL_SCHEDULE(msg) {
    return cancelSchedule(msg.id);
  },
  async STOP_REPOST() {
    await chrome.alarms.clear("repost");
    await chrome.storage.local.remove(REPOST_KEY);
    return { success: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = msg && handlers[msg.type];
  if (!handler) return false;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new FbError("TIMEOUT", "Hết thời gian chờ phản hồi từ Facebook")), 30000));
  Promise.race([handler(msg), timeout])
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err?.message || "Lỗi không xác định", code: err?.code }));
  return true;
});
