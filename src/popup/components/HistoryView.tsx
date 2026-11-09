import React, { useState } from "react";
import {
  IoArrowUndo,
  IoDocumentText,
  IoLockClosed,
  IoMusicalNotes,
  IoTime,
  IoTrash,
} from "react-icons/io5";
import type { HistoryItem } from "../types";
import type { T } from "../lib/i18n";
import { durationLabel, timeAgo } from "../lib/format";

interface HistoryViewProps {
  items: HistoryItem[];
  onReuse: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  t: T;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  items,
  onReuse,
  onDelete,
  onClear,
  t,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (items.length === 0) {
    return (
      <div className="tab-pane">
        <div className="empty-state">
          <div className="empty-icon">
            <IoDocumentText size={26} />
          </div>
          <strong>{t("history.empty")}</strong>
          <span>{t("history.emptyHint")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-pane">
      <div className="pane-toolbar">
        {confirmClear ? (
          <div className="delete-confirm">
            <span className="muted">{t("history.clearConfirm")}</span>
            <button
              type="button"
              className="btn-danger-xs"
              onClick={() => {
                setConfirmClear(false);
                onClear();
              }}
            >
              {t("common.delete")}
            </button>
            <button
              type="button"
              className="btn-ghost-xs"
              onClick={() => setConfirmClear(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setConfirmClear(true)}>
            <IoTrash size={12} /> {t("history.clear")}
          </button>
        )}
      </div>

      <div className="item-list">
        {items.map((item) => {
          const meta = item.payload.meta;
          const music = item.payload.selectedMusic;
          const aud = item.payload.audienceSetting;
          return (
            <div key={item.id} className="card-item">
              <div className="card-item-top">
                <span className="card-time">{timeAgo(item.at, t)}</span>
                {item.source !== "popup" && (
                  <span className="badge badge-neutral">
                    {t(`history.source.${item.source}` as const)}
                  </span>
                )}
                <span className="card-meta-pill">
                  {t(`audience.${aud}` as const)} · <IoTime size={11} />{" "}
                  {durationLabel(item.payload.duration)}
                </span>
              </div>

              {meta?.text ? (
                <div className="card-text">{meta.text}</div>
              ) : (
                !meta?.secret &&
                music && <div className="card-text muted">{t("history.musicOnly")}</div>
              )}

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

              <div className="card-item-actions">
                <button
                  type="button"
                  className="btn-soft-xs"
                  onClick={() => onReuse(item)}
                >
                  <IoArrowUndo size={12} /> {t("history.reuse")}
                </button>
                <button
                  type="button"
                  className="icon-circle danger"
                  onClick={() => onDelete(item.id)}
                  title={t("common.delete")}
                >
                  <IoTrash size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
