import React, { useEffect, useState } from "react";
import {
  IoEarth,
  IoLockClosed,
  IoMusicalNotes,
  IoPeople,
  IoPeopleCircle,
  IoPersonCircle,
  IoRefresh,
  IoTime,
  IoTrash,
} from "react-icons/io5";
import type { Audience, Draft, NoteStatus } from "../types";
import type { T } from "../lib/i18n";
import { splitHidden } from "../lib/hidden";
import { durationLabel, formatRemaining } from "../lib/format";

interface NoteCardProps {
  status: NoteStatus | null;
  loading: boolean;
  deleting: boolean;
  draft: Draft;
  onRefresh: () => void;
  onDelete: () => void;
  t: T;
}

const AudienceIcon: React.FC<{ value: string }> = ({ value }) => {
  const v = value.toUpperCase();
  if (v === "PUBLIC") return <IoEarth size={12} />;
  if (v === "CONTACTS") return <IoPeopleCircle size={12} />;
  if (v === "CUSTOM") return <IoLockClosed size={12} />;
  return <IoPeople size={12} />;
};

export const NoteCard: React.FC<NoteCardProps> = ({
  status,
  loading,
  deleting,
  draft,
  onRefresh,
  onDelete,
  t,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Live countdown tick every 15s while popup is open
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const hasDraft =
    Boolean(draft.text.trim()) ||
    Boolean(draft.secretEnabled && draft.secret.trim()) ||
    Boolean(draft.music);

  const activeDecoded = splitHidden(status?.description);
  const hasActiveNote = Boolean(
    status &&
      (activeDecoded.visible ||
        activeDecoded.secret ||
        status.musicTitle ||
        status.richStatusId)
  );

  // Mode: if user is typing/picking in composer -> live preview; else current active note
  const isLivePreview = hasDraft;

  const bubbleText = isLivePreview
    ? draft.text.trim()
    : activeDecoded.visible;

  const bubbleSecret = isLivePreview
    ? draft.secretEnabled
      ? draft.secret.trim()
      : ""
    : activeDecoded.secret;

  const musicTitle = isLivePreview ? draft.music?.title || null : status?.musicTitle || null;
  const musicArtist = isLivePreview ? draft.music?.artist || null : status?.musicArtist || null;

  const audienceValue: Audience = isLivePreview
    ? draft.audience
    : ((status?.visibility?.toUpperCase() as Audience) ||
        (status?.defaultAudienceSetting?.toUpperCase() as Audience) ||
        "FRIENDS");

  const audienceText = (() => {
    if (audienceValue === "CUSTOM") {
      const names = isLivePreview
        ? draft.friends.map((f) => f.name)
        : status?.customAudienceNames || [];
      if (names.length > 0) {
        const head = names.slice(0, 2).join(", ");
        return names.length > 2 ? `${head} +${names.length - 2}` : head;
      }
      return t("audience.CUSTOM");
    }
    if (audienceValue === "PUBLIC") return t("audience.PUBLIC");
    if (audienceValue === "CONTACTS") return t("audience.CONTACTS");
    return t("audience.FRIENDS");
  })();

  const timeText = (() => {
    if (isLivePreview) {
      return durationLabel(draft.duration);
    }
    if (!status?.expirationTime) return "";
    const diffSec = status.expirationTime - now / 1000;
    if (diffSec <= 0) return t("card.expired");
    return t("card.expires", { time: formatRemaining(diffSec, t) });
  })();

  const isEmpty = !isLivePreview && !hasActiveNote && !loading;

  return (
    <section className="note-stage">
      <div className="stage-topbar">
        <span className={`stage-pill ${isLivePreview ? "is-preview" : ""}`}>
          <span className="stage-dot" />
          {isLivePreview ? t("card.preview") : t("card.current")}
        </span>
        <div className="stage-actions">
          <button
            type="button"
            className="stage-icon-btn"
            onClick={onRefresh}
            disabled={loading}
            title={t("card.refresh")}
          >
            <IoRefresh size={14} className={loading ? "spin" : ""} />
          </button>
          {hasActiveNote && !isLivePreview && status?.richStatusId && (
            confirmDelete ? (
              <div className="delete-confirm">
                <button
                  type="button"
                  className="btn-danger-xs"
                  disabled={deleting}
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete();
                  }}
                >
                  {t("common.delete")}
                </button>
                <button
                  type="button"
                  className="btn-ghost-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="stage-icon-btn danger"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                title={t("card.delete")}
              >
                <IoTrash size={14} />
              </button>
            )
          )}
        </div>
      </div>

      <div className="stage-center">
        <div className={`note-bubble ${loading && !isLivePreview ? "shimmer" : ""} ${isEmpty ? "is-empty" : ""}`}>
          {loading && !isLivePreview ? (
            <span className="bubble-placeholder">{t("card.loading")}</span>
          ) : isEmpty ? (
            <span className="bubble-placeholder">{t("card.empty")}</span>
          ) : (
            <>
              {musicTitle && (
                <div className="bubble-music">
                  <span className="music-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <IoMusicalNotes size={12} />
                  <span className="bubble-music-title">{musicTitle}</span>
                  {musicArtist && <span className="bubble-music-artist">· {musicArtist}</span>}
                </div>
              )}
              {bubbleText && <div className="bubble-text">{bubbleText}</div>}
              {bubbleSecret && (
                <div className="bubble-secret" title={t("compose.secret")}>
                  <IoLockClosed size={11} />
                  <span>{bubbleSecret}</span>
                </div>
              )}
            </>
          )}
          <div className="bubble-tail" aria-hidden="true">
            <span className="tail-dot lg" />
            <span className="tail-dot sm" />
          </div>
        </div>

        <div className="stage-avatar-wrap">
          {status?.avatarUri ? (
            <img src={status.avatarUri} alt="" className="stage-avatar" />
          ) : (
            <div className="stage-avatar fallback">
              <IoPersonCircle size={56} />
            </div>
          )}
          <span className="online-ring" />
        </div>

        <div className="stage-user">{status?.userName || t("card.you")}</div>

        {!isEmpty && (
          <div className="stage-meta">
            <span className="meta-item">
              <AudienceIcon value={audienceValue} />
              <span>{audienceText}</span>
            </span>
            {timeText && (
              <>
                <span className="meta-sep">·</span>
                <span className="meta-item">
                  <IoTime size={12} />
                  <span>{timeText}</span>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
