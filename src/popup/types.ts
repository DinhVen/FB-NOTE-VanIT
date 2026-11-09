export type Audience = "FRIENDS" | "PUBLIC" | "CONTACTS" | "CUSTOM";

export interface Friend {
  id: string;
  name: string;
  imageUri?: string;
}

export interface FriendGroup {
  id: string;
  name: string;
  friends: Friend[];
}

export interface MusicItem {
  id: string;
  songId?: string;
  audioClusterId?: string;
  title: string;
  artist: string;
  imageUri?: string;
  durationMs?: number;
  progressiveDownloadUrl?: string;
}

export interface NoteStatus {
  richStatusId: string | null;
  userName: string | null;
  avatarUri: string | null;
  description: string | null;
  noteType: string | null;
  visibility: string | null;
  expirationTime: number | null;
  musicTitle: string | null;
  musicArtist: string | null;
  customAudienceNames: string[];
  defaultAudienceSetting: string | null;
}

/** Human readable info kept alongside a payload (history / schedule lists). */
export interface NoteMeta {
  text: string;
  secret: string;
  friendNames: string[];
}

export interface NotePayload {
  description: string | null;
  duration: number;
  audienceSetting: Audience;
  selectedFriendIds: string[];
  selectedMusic: MusicItem | null;
  musicTrimStartMs: number;
  autoRepost?: { times: number };
  meta: NoteMeta;
}

export interface HistoryItem {
  id: string;
  at: number;
  source: "popup" | "schedule" | "repost";
  payload: NotePayload;
}

export interface ScheduleItem {
  id: string;
  at: number;
  createdAt: number;
  payload: NotePayload;
  status: "pending" | "done" | "failed";
  attempts: number;
  error: string | null;
  doneAt?: number;
}

export interface RepostState {
  payload: NotePayload;
  remaining: number;
  nextAt: number | null;
  attempts: number;
  lastError: string | null;
}

export interface Draft {
  text: string;
  secret: string;
  secretEnabled: boolean;
  audience: Audience;
  friends: Friend[];
  duration: number;
  music: MusicItem | null;
  trimStartMs: number;
  scheduleEnabled: boolean;
  scheduleAt: string; // datetime-local value
  repostEnabled: boolean;
  repostTimes: number;
}

export type ThemeMode = "system" | "light" | "dark";
export type Lang = "vi" | "en";

export interface Settings {
  theme: ThemeMode;
  lang: Lang;
}
