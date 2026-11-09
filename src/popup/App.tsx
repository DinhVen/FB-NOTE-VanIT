import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IoAlertCircle,
  IoCalendar,
  IoCreate,
  IoLogoFacebook,
  IoMoon,
  IoRefresh,
  IoSettingsSharp,
  IoSunny,
  IoTime,
} from "react-icons/io5";
import type {
  Draft,
  FriendGroup,
  HistoryItem,
  NotePayload,
  NoteStatus,
  RepostState,
  ScheduleItem,
  Settings,
} from "./types";
import { createT } from "./lib/i18n";
import { buildDescription, descriptionLength } from "./lib/hidden";
import { MAX_LENGTH, MIN_REPOST_SEC, toLocalInput } from "./lib/format";
import {
  DEFAULT_DRAFT,
  DEFAULT_SETTINGS,
  KEYS,
  api,
  useStored,
} from "./lib/storage";
import { NoteCard } from "./components/NoteCard";
import { Composer } from "./components/Composer";
import { AudienceSheet } from "./components/AudienceSheet";
import { DurationSheet } from "./components/DurationSheet";
import { MusicSheet } from "./components/MusicSheet";
import { ScheduleView } from "./components/ScheduleView";
import { HistoryView } from "./components/HistoryView";
import { SettingsSheet } from "./components/SettingsSheet";

type Tab = "compose" | "schedule" | "history";
type ActiveSheet = "audience" | "duration" | "music" | "settings" | null;
type ConnState = "checking" | "ready" | "no_tab" | "not_logged_in" | "error";

export const App: React.FC = () => {
  const [settings, setSettings] = useStored<Settings>(KEYS.settings, DEFAULT_SETTINGS);
  const [draft, setDraft] = useStored<Draft>(KEYS.draft, DEFAULT_DRAFT);
  const [groups, setGroups] = useStored<FriendGroup[]>(KEYS.groups, []);
  const [history, setHistory] = useStored<HistoryItem[]>(KEYS.history, []);
  const [schedules, setSchedules] = useStored<ScheduleItem[]>(KEYS.schedules, []);
  const [repost] = useStored<RepostState | null>(KEYS.repost, null);
  const [observerEnabled, setObserverEnabled] = useStored<boolean>(KEYS.observer, true);

  const [tab, setTab] = useState<Tab>("compose");
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [conn, setConn] = useState<ConnState>("checking");
  const [connError, setConnError] = useState<string>("");

  const [status, setStatus] = useState<NoteStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isErr?: boolean } | null>(null);

  const t = useMemo(() => createT(settings.lang), [settings.lang]);

  // Apply theme to <html data-theme="...">
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        settings.theme === "system" ? (mq.matches ? "dark" : "light") : settings.theme;
      document.documentElement.setAttribute("data-theme", resolved);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  const showToast = useCallback((msg: string, isErr = false) => {
    setToast({ msg, isErr });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const updateDraft = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
    },
    [setDraft]
  );

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await api.getStatus();
    setStatusLoading(false);
    if (res.success) {
      setConn("ready");
      setStatus(res.status || null);
      return;
    }
    if (res.code === "NO_TAB") setConn("no_tab");
    else if (res.code === "NOT_LOGGED_IN") setConn("not_logged_in");
    else {
      setConn("error");
      setConnError(res.error || "");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleDeleteNote = async () => {
    if (!status?.richStatusId || deleting) return;
    setDeleting(true);
    const res = await api.deleteNote(status.richStatusId);
    setDeleting(false);
    if (res.success) {
      showToast(t("toast.deleted"));
      loadStatus();
    } else {
      showToast(res.error || "Delete failed", true);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const visible = draft.text.trim();
    const secret = draft.secretEnabled ? draft.secret.trim() : "";
    const fullDesc = buildDescription(visible, secret);
    const hasMusic = Boolean(draft.music?.id);

    if (!fullDesc && !hasMusic) {
      showToast(t("err.empty"), true);
      return;
    }
    if (descriptionLength(visible, secret) > MAX_LENGTH) {
      showToast(t("compose.tooLong", { max: MAX_LENGTH }), true);
      return;
    }
    if (draft.audience === "CUSTOM" && draft.friends.length === 0) {
      showToast(t("err.noFriends"), true);
      setSheet("audience");
      return;
    }
    if (draft.repostEnabled && draft.duration < MIN_REPOST_SEC) {
      showToast(t("err.repostDuration"), true);
      return;
    }

    const payload: NotePayload = {
      description: fullDesc || null,
      duration: draft.duration,
      audienceSetting: draft.audience,
      selectedFriendIds: draft.friends.map((f) => f.id),
      selectedMusic: draft.music,
      musicTrimStartMs: draft.trimStartMs,
      autoRepost:
        draft.repostEnabled && draft.duration >= MIN_REPOST_SEC
          ? { times: draft.repostTimes }
          : undefined,
      meta: {
        text: visible,
        secret,
        friendNames: draft.friends.map((f) => f.name),
      },
    };

    if (draft.scheduleEnabled) {
      const when = new Date(draft.scheduleAt).getTime();
      if (!Number.isFinite(when) || when < Date.now() + 30_000) {
        showToast(t("err.scheduleTime"), true);
        return;
      }
      setSubmitting(true);
      const res = await api.scheduleNote(when, payload);
      setSubmitting(false);
      if (res.success) {
        showToast(t("toast.scheduled"));
        updateDraft({
          text: "",
          secret: "",
          secretEnabled: false,
          scheduleEnabled: false,
          scheduleAt: toLocalInput(Date.now() + 60 * 60 * 1000),
        });
        setTab("schedule");
      } else {
        showToast(res.error || "Schedule failed", true);
      }
      return;
    }

    setSubmitting(true);
    const res = await api.createNote(payload);
    setSubmitting(false);
    if (res.success) {
      showToast(t("toast.shared"));
      updateDraft({ text: "", secret: "", secretEnabled: false });
      loadStatus();
    } else {
      showToast(res.error || "Failed", true);
    }
  };

  const handleReuse = (item: HistoryItem) => {
    const p = item.payload;
    updateDraft({
      text: p.meta?.text || "",
      secret: p.meta?.secret || "",
      secretEnabled: Boolean(p.meta?.secret),
      audience: p.audienceSetting,
      duration: p.duration,
      music: p.selectedMusic,
      trimStartMs: p.musicTrimStartMs || 0,
    });
    setTab("compose");
    showToast(t("toast.reused"));
  };

  const pendingCount =
    schedules.filter((s) => s.status === "pending").length +
    (repost && repost.remaining > 0 ? 1 : 0);

  const cycleTheme = () => {
    const next =
      settings.theme === "dark" ? "light" : settings.theme === "light" ? "dark" : "dark";
    setSettings({ ...settings, theme: next });
  };

  return (
    <div className="app-shell">
      {/* Top App Bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <img src="./icons/icon32.png" alt="Logo" width="20" height="20" style={{ display: "block", borderRadius: "5px" }} />
          </span>
          <div className="brand-text">
            <strong>{t("app.name")}</strong>
            <span>{t("app.by")}</span>
          </div>
        </div>

        <nav className="nav-tabs" role="tablist">
          <button
            type="button"
            className={`nav-tab ${tab === "compose" ? "active" : ""}`}
            onClick={() => setTab("compose")}
          >
            <IoCreate size={14} />
            <span>{t("tab.compose")}</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${tab === "schedule" ? "active" : ""}`}
            onClick={() => setTab("schedule")}
          >
            <IoCalendar size={14} />
            <span>{t("tab.schedule")}</span>
            {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
          </button>
          <button
            type="button"
            className={`nav-tab ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            <IoTime size={14} />
            <span>{t("tab.history")}</span>
          </button>
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="icon-circle"
            onClick={cycleTheme}
            title={t("settings.theme")}
          >
            {settings.theme === "light" ? <IoSunny size={15} /> : <IoMoon size={15} />}
          </button>
          <button
            type="button"
            className="icon-circle"
            onClick={() => setSheet("settings")}
            title={t("settings.title")}
          >
            <IoSettingsSharp size={15} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-area">
        {conn !== "ready" && conn !== "checking" && tab === "compose" ? (
          <div className="connect-card">
            <div className="connect-icon">
              {conn === "no_tab" ? (
                <IoLogoFacebook size={32} />
              ) : (
                <IoAlertCircle size={32} />
              )}
            </div>
            <h3>
              {conn === "no_tab"
                ? t("conn.noTab.title")
                : conn === "not_logged_in"
                  ? t("conn.noLogin.title")
                  : t("conn.error.title")}
            </h3>
            <p>
              {conn === "no_tab"
                ? t("conn.noTab.desc")
                : conn === "not_logged_in"
                  ? t("conn.noLogin.desc")
                  : connError}
            </p>
            <div className="connect-actions">
              <button
                type="button"
                className="btn-share"
                onClick={() => chrome.tabs.create({ url: "https://www.facebook.com" })}
              >
                <IoLogoFacebook size={16} />
                <span>{t("conn.open")}</span>
              </button>
              <button type="button" className="btn-soft-xs" onClick={loadStatus}>
                <IoRefresh size={14} />
                <span>{t("conn.retry")}</span>
              </button>
            </div>
          </div>
        ) : tab === "compose" ? (
          <>
            <NoteCard
              status={status}
              loading={statusLoading || conn === "checking"}
              deleting={deleting}
              draft={draft}
              onRefresh={loadStatus}
              onDelete={handleDeleteNote}
              t={t}
            />
            <Composer
              draft={draft}
              submitting={submitting}
              onChange={updateDraft}
              onOpenSheet={(s) => setSheet(s)}
              onSubmit={handleSubmit}
              t={t}
            />
          </>
        ) : tab === "schedule" ? (
          <ScheduleView
            schedules={schedules}
            repost={repost}
            lang={settings.lang}
            onCancel={(id) => api.cancelSchedule(id)}
            onClearDone={() =>
              setSchedules((prev) => prev.filter((s) => s.status === "pending"))
            }
            onStopRepost={() => api.stopRepost()}
            t={t}
          />
        ) : (
          <HistoryView
            items={history}
            onReuse={handleReuse}
            onDelete={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
            onClear={() => setHistory([])}
            t={t}
          />
        )}
      </main>

      {/* Bottom Sheets */}
      {sheet === "audience" && (
        <AudienceSheet
          audience={draft.audience}
          friends={draft.friends}
          groups={groups}
          onChangeAudience={(audience) => updateDraft({ audience })}
          onChangeFriends={(friends) => updateDraft({ friends })}
          onChangeGroups={setGroups}
          onToast={showToast}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}

      {sheet === "duration" && (
        <DurationSheet
          duration={draft.duration}
          lang={settings.lang}
          onChange={(duration) => updateDraft({ duration })}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}

      {sheet === "music" && (
        <MusicSheet
          selected={draft.music}
          trimStartMs={draft.trimStartMs}
          onSelect={(music) => updateDraft({ music })}
          onChangeTrim={(trimStartMs) => updateDraft({ trimStartMs })}
          onToast={showToast}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}

      {sheet === "settings" && (
        <SettingsSheet
          settings={settings}
          observerEnabled={observerEnabled}
          onChangeSettings={setSettings}
          onChangeObserver={setObserverEnabled}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}

      {toast && (
        <div className={`toast-pill ${toast.isErr ? "err" : "ok"}`}>{toast.msg}</div>
      )}
    </div>
  );
};
