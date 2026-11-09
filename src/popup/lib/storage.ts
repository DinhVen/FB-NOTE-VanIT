import { useEffect, useState } from "react";
import type {
  Draft,
  Friend,
  FriendGroup,
  HistoryItem,
  MusicItem,
  NotePayload,
  NoteStatus,
  RepostState,
  ScheduleItem,
  Settings,
} from "../types";
import { detectLang } from "./i18n";
import { toLocalInput } from "./format";

export const KEYS = {
  settings: "settingsV2",
  draft: "draftV2",
  groups: "friendGroupsV1",
  history: "historyV1",
  schedules: "schedulesV1",
  repost: "autoRepostV1",
  observer: "observerEnabled",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  lang: detectLang(),
};

export const DEFAULT_DRAFT: Draft = {
  text: "",
  secret: "",
  secretEnabled: false,
  audience: "FRIENDS",
  friends: [],
  duration: 24 * 60 * 60,
  music: null,
  trimStartMs: 0,
  scheduleEnabled: false,
  scheduleAt: toLocalInput(Date.now() + 60 * 60 * 1000),
  repostEnabled: false,
  repostTimes: 3,
};

/** Reactive wrapper around a `chrome.storage.local` key. */
export function useStored<V>(key: string, fallback: V): [V, (next: V | ((prev: V) => V)) => void] {
  const [value, setValue] = useState<V>(fallback);

  useEffect(() => {
    chrome.storage.local.get([key], (res) => {
      if (res && res[key] !== undefined) setValue(res[key] as V);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[key]) {
        setValue((changes[key].newValue as V) ?? fallback);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [key]);

  const update = (next: V | ((prev: V) => V)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: V) => V)(prev) : next;
      chrome.storage.local.set({ [key]: resolved });
      return resolved;
    });
  };

  return [value, update];
}

// ---------------------------------------------------------------------------
// Background messaging helpers
// ---------------------------------------------------------------------------
function send<R>(msg: Record<string, unknown>): Promise<R> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: chrome.runtime.lastError.message || "Background worker unavailable",
        } as unknown as R);
        return;
      }
      resolve(response as R);
    });
  });
}

export type BaseRes = { success: boolean; error?: string; code?: string };

export const api = {
  getSession: () => send<BaseRes & { userId?: string }>({ type: "GET_SESSION" }),
  getStatus: () => send<BaseRes & { status?: NoteStatus }>({ type: "GET_STATUS" }),
  createNote: (payload: NotePayload) => send<BaseRes>({ type: "CREATE_NOTE", payload }),
  deleteNote: (richStatusId: string) => send<BaseRes>({ type: "DELETE_NOTE", richStatusId }),
  searchMusic: (query: string, count = 80) =>
    send<BaseRes & { items?: MusicItem[] }>({ type: "SEARCH_MUSIC", query, count }),
  searchFriends: (query: string, cursor: string | null = null, count = 20) =>
    send<BaseRes & { items?: Friend[]; nextCursor?: string | null; hasNextPage?: boolean }>({
      type: "SEARCH_FRIENDS",
      query,
      cursor,
      count,
    }),
  scheduleNote: (at: number, payload: NotePayload) =>
    send<BaseRes & { id?: string }>({ type: "SCHEDULE_NOTE", at, payload }),
  cancelSchedule: (id: string) => send<BaseRes>({ type: "CANCEL_SCHEDULE", id }),
  stopRepost: () => send<BaseRes>({ type: "STOP_REPOST" }),
};

export type StoredTypes = {
  groups: FriendGroup[];
  history: HistoryItem[];
  schedules: ScheduleItem[];
  repost: RepostState | null;
};
