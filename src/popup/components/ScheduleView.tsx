import React from "react";
import {
  IoAlertCircle,
  IoCalendar,
  IoCheckmarkCircle,
  IoHourglass,
  IoLockClosed,
  IoMusicalNotes,
  IoRepeat,
  IoTrash,
} from "react-icons/io5";
import type { RepostState, ScheduleItem } from "../types";
import type { T } from "../lib/i18n";
import { formatDateTime, formatRemaining } from "../lib/format";

interface ScheduleViewProps {
  schedules: ScheduleItem[];
  repost: RepostState | null;
  lang: string;
  onCancel: (id: string) => void;
  onClearDone: () => void;
  onStopRepost: () => void;
  t: T;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  schedules,
  repost,
  lang,
  onCancel,
  onClearDone,
  onStopRepost,
  t,
}) => {
  const activeRepost = repost && repost.remaining > 0 ? repost : null;
  const hasFinished = schedules.some((s) => s.status !== "pending");
  const sorted = [...schedules].sort((a, b) => a.at - b.at);

  return (
    <div className="tab-pane">
      {activeRepost && (
        <div className="repost-banner">
          <div className="repost-icon">
            <IoRepeat size={18} />
          </div>
          <div className="repost-body">
            <strong>{t("schedule.repostTitle")}</strong>
            <span>
              {t("schedule.repostRemaining", {
                count: activeRepost.remaining,
                time: activeRepost.nextAt ? formatDateTime(activeRepost.nextAt, lang) : "--",
              })}
            </span>
            {activeRepost.payload.meta?.text && (
              <small className="repost-preview">“{activeRepost.payload.meta.text}”</small>
            )}
          </div>
          <button type="button" className="btn-danger-xs" onClick={onStopRepost}>
            {t("schedule.repostStop")}
          </button>
        </div>
      )}

      {hasFinished && (
        <div className="pane-toolbar">
          <button type="button" className="link-btn" onClick={onClearDone}>
            <IoTrash size={12} /> {t("schedule.clearDone")}
          </button>
        </div>
      )}

      {sorted.length === 0 && !activeRepost ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IoCalendar size={26} />
          </div>
          <strong>{t("schedule.empty")}</strong>
          <span>{t("schedule.emptyHint")}</span>
        </div>
      ) : (
        <div className="item-list">
          {sorted.map((item) => {
            const meta = item.payload.meta;
            const music = item.payload.selectedMusic;
            const inSec = (item.at - Date.now()) / 1000;
            return (
              <div key={item.id} className={`card-item status-${item.status}`}>
                <div className="card-item-top">
                  <span className={`badge badge-${item.status}`}>
                    {item.status === "pending" && <IoHourglass size={11} />}
                    {item.status === "done" && <IoCheckmarkCircle size={12} />}
                    {item.status === "failed" && <IoAlertCircle size={12} />}
                    {t(`schedule.${item.status}` as const)}
                  </span>
                  <span className="card-time">
                    {formatDateTime(item.at, lang)}
                    {item.status === "pending" && inSec > 0 && (
                      <> · {t("schedule.in", { time: formatRemaining(inSec, t) })}</>
                    )}
                  </span>
                  {item.status === "pending" && (
                    <button
                      type="button"
                      className="btn-ghost-xs danger"
                      onClick={() => onCancel(item.id)}
                    >
                      {t("schedule.cancel")}
                    </button>
                  )}
                </div>

                {meta?.text && <div className="card-text">{meta.text}</div>}
                {meta?.secret && (
                  <div className="card-secret">
                    <IoLockClosed size={11} /> {meta.secret}
                  </div>
                )}
                {music && (
                  <div className="card-music">
                    <IoMusicalNotes size={12} /> {music.title}
                    {music.artist ? ` · ${music.artist}` : ""}
                  </div>
                )}
                {item.error && <div className="card-error">{item.error}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
