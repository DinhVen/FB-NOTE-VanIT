import type { T } from "./i18n";

export const MAX_LENGTH = 600;
export const MAX_DURATION_SEC = 8 * 24 * 60 * 60;
export const MIN_REPOST_SEC = 60 * 60;
export const TRIM_WINDOW_MS = 30_000;

/** "5 giờ 12 phút" style remaining time. */
export function formatRemaining(seconds: number, t: T): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (s < 60) return `${s}s`;
  if (d) return h ? `${d} ${t("unit.d")} ${h} ${t("unit.h")}` : `${d} ${t("unit.d")}`;
  if (h) return m ? `${h} ${t("unit.h")} ${m} ${t("unit.m")}` : `${h} ${t("unit.h")}`;
  return `${m} ${t("unit.m")}`;
}

/** Compact duration label for chips, e.g. 24h, 3d, 45m. */
export function durationLabel(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${Math.round((seconds % 3600) / 60)}m`;
  return `${Math.round(seconds / 60)}m`;
}

export function formatClock(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) return "--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDateTime(ms: number, lang: string): string {
  return new Date(ms).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function timeAgo(ms: number, t: T): string {
  const diff = Math.max(0, Date.now() - ms) / 1000;
  if (diff < 60) return t("time.now");
  if (diff < 3600) return t("time.minutesAgo", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("time.hoursAgo", { n: Math.floor(diff / 3600) });
  return t("time.daysAgo", { n: Math.floor(diff / 86400) });
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
