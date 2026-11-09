import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoCheckmark,
  IoClose,
  IoMusicalNotes,
  IoPause,
  IoPlay,
  IoSearch,
  IoTrash,
} from "react-icons/io5";
import type { MusicItem } from "../types";
import type { T } from "../lib/i18n";
import { TRIM_WINDOW_MS, formatClock } from "../lib/format";
import { api } from "../lib/storage";
import { Sheet } from "./Sheet";

interface MusicSheetProps {
  selected: MusicItem | null;
  trimStartMs: number;
  onSelect: (m: MusicItem | null) => void;
  onChangeTrim: (ms: number) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onClose: () => void;
  t: T;
}

const PAGE = 15;

export const MusicSheet: React.FC<MusicSheetProps> = ({
  selected,
  trimStartMs,
  onSelect,
  onChangeTrim,
  onToast,
  onClose,
  t,
}) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MusicItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const [loading, setLoading] = useState(false);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [trimPlaying, setTrimPlaying] = useState(false);
  const [trimProgressMs, setTrimProgressMs] = useState(0);

  // Trim drag state
  const waveRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startMs: number } | null>(null);
  const trimStartRef = useRef(trimStartMs);
  trimStartRef.current = trimStartMs;

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setTrimPlaying(false);
    setTrimProgressMs(0);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // Debounced music search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await api.searchMusic(query, 90);
      setLoading(false);
      if (res.success) {
        setItems(res.items || []);
        setVisibleCount(PAGE);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const clampTrim = useCallback(
    (ms: number) => {
      const dur = selected?.durationMs || 0;
      const maxStart = Math.max(0, dur - TRIM_WINDOW_MS);
      return Math.min(Math.max(0, Math.round(ms)), maxStart);
    },
    [selected?.durationMs]
  );

  // Dragging the 30s window on the waveform
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !selected || !waveRef.current) return;
      const rect = waveRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaRatio = (e.clientX - dragRef.current.startX) / rect.width;
      const dur = selected.durationMs || 0;
      onChangeTrim(clampTrim(dragRef.current.startMs + deltaRatio * dur));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (trimPlaying && audioRef.current) {
        audioRef.current.currentTime = trimStartRef.current / 1000;
        setTrimProgressMs(0);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [selected, trimPlaying, clampTrim, onChangeTrim]);

  const toggleRowPlay = (item: MusicItem) => {
    if (playingId === item.id) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!item.progressiveDownloadUrl) {
      onToast(t("err.playback"), true);
      return;
    }
    const audio = new Audio(item.progressiveDownloadUrl);
    audioRef.current = audio;
    setPlayingId(item.id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      onToast(t("err.playback"), true);
    };
    audio.play().catch(() => {
      setPlayingId(null);
      onToast(t("err.playback"), true);
    });
  };

  const toggleTrimPlay = () => {
    if (!selected) return;
    if (trimPlaying) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!selected.progressiveDownloadUrl) {
      onToast(t("err.playback"), true);
      return;
    }
    const audio = new Audio(selected.progressiveDownloadUrl);
    audioRef.current = audio;
    audio.currentTime = trimStartMs / 1000;
    setTrimPlaying(true);
    audio.ontimeupdate = () => {
      const elapsed = Math.max(0, audio.currentTime * 1000 - trimStartRef.current);
      setTrimProgressMs(Math.min(elapsed, TRIM_WINDOW_MS));
      if (elapsed >= TRIM_WINDOW_MS) stopAudio();
    };
    audio.onended = () => stopAudio();
    audio.onerror = () => {
      stopAudio();
      onToast(t("err.playback"), true);
    };
    audio.play().catch(() => {
      stopAudio();
      onToast(t("err.playback"), true);
    });
  };

  const bars = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const seed = ((i + 1) * 1103515245 + 12345) >>> 0;
        return 6 + (((seed >> 16) & 0x7fff) / 0x7fff) * 22;
      }),
    []
  );

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const dur = selected?.durationMs || 0;
  const winLeftPct = dur > 0 ? (trimStartMs / dur) * 100 : 0;
  const winWidthPct = dur > 0 ? Math.min(100, Math.max(10, (TRIM_WINDOW_MS / dur) * 100)) : 40;

  return (
    <Sheet
      title={t("music.title")}
      onClose={() => {
        stopAudio();
        onClose();
      }}
      rightAction={
        <button
          type="button"
          className="btn-primary-xs"
          onClick={() => {
            stopAudio();
            onClose();
          }}
        >
          <IoCheckmark size={14} /> {t("common.done")}
        </button>
      }
    >
      {selected && (
        <div className="selected-music-card">
          <div className="selected-music-head">
            {selected.imageUri ? (
              <img src={selected.imageUri} alt="" className="music-thumb" />
            ) : (
              <div className="music-thumb fallback">
                <IoMusicalNotes size={16} />
              </div>
            )}
            <div className="selected-music-info">
              <strong>{selected.title}</strong>
              <span>{selected.artist || t("music.unknownArtist")}</span>
            </div>
            <button
              type="button"
              className="icon-circle"
              onClick={toggleTrimPlay}
              title={trimPlaying ? "Pause" : "Play"}
            >
              {trimPlaying ? <IoPause size={15} /> : <IoPlay size={15} />}
            </button>
            <button
              type="button"
              className="icon-circle danger"
              onClick={() => {
                stopAudio();
                onSelect(null);
              }}
              title={t("music.remove")}
            >
              <IoTrash size={14} />
            </button>
          </div>

          {/* 30-second waveform trimmer */}
          <div className="trim-box">
            <div className="trim-meta">
              <span>{formatClock(trimStartMs + trimProgressMs)}</span>
              <span className="muted">{t("music.trim")}</span>
              <span>{formatClock(Math.min(dur, trimStartMs + TRIM_WINDOW_MS))}</span>
            </div>
            <div
              className="wave-track"
              ref={waveRef}
              onClick={(e) => {
                if (!dur) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                const next = clampTrim(ratio * dur - TRIM_WINDOW_MS / 2);
                onChangeTrim(next);
                if (trimPlaying && audioRef.current) {
                  audioRef.current.currentTime = next / 1000;
                  setTrimProgressMs(0);
                }
              }}
            >
              {bars.map((h, idx) => (
                <span key={idx} className="wave-bar" style={{ height: `${h}px` }} />
              ))}
              <div
                className="trim-window"
                style={{ left: `${winLeftPct}%`, width: `${winWidthPct}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = { startX: e.clientX, startMs: trimStartMs };
                }}
              >
                <div
                  className="trim-progress"
                  style={{ width: `${(trimProgressMs / TRIM_WINDOW_MS) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search field */}
      <div className="search-field">
        <IoSearch size={15} className="search-icon" />
        <input
          type="text"
          placeholder={t("music.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search-clear" onClick={() => setQuery("")}>
            <IoClose size={14} />
          </button>
        )}
      </div>

      {/* Track list */}
      <div
        className="picker-list"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40 && visibleCount < items.length) {
            setVisibleCount((c) => Math.min(c + PAGE, items.length));
          }
        }}
      >
        {visibleItems.map((item) => {
          const isSel = selected?.id === item.id;
          const isPlay = playingId === item.id;
          return (
            <div
              key={`${item.id}-${item.songId || ""}`}
              className={`picker-row ${isSel ? "active" : ""}`}
              onClick={() => {
                onSelect(item);
                onChangeTrim(0);
              }}
            >
              {item.imageUri ? (
                <img src={item.imageUri} alt="" className="music-thumb" loading="lazy" />
              ) : (
                <div className="music-thumb fallback">
                  <IoMusicalNotes size={16} />
                </div>
              )}
              <div className="row-stack">
                <strong className="row-title">{item.title}</strong>
                <span className="row-sub">{item.artist || t("music.unknownArtist")}</span>
              </div>
              <span className="row-meta">{formatClock(item.durationMs)}</span>
              <button
                type="button"
                className={`play-circle ${isPlay ? "playing" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRowPlay(item);
                }}
              >
                {isPlay ? <IoPause size={13} /> : <IoPlay size={13} />}
              </button>
            </div>
          );
        })}
        {loading && <div className="list-hint">{t("common.loading")}</div>}
        {!loading && items.length === 0 && <div className="list-hint">{t("music.empty")}</div>}
      </div>
    </Sheet>
  );
};
