import React, { useRef, useState } from "react";
import {
  IoCalendar,
  IoChevronForward,
  IoClose,
  IoEarth,
  IoHappy,
  IoLockClosed,
  IoMusicalNotes,
  IoPeople,
  IoPeopleCircle,
  IoRepeat,
  IoSend,
  IoTime,
} from "react-icons/io5";
import type { Audience, Draft } from "../types";
import type { T } from "../lib/i18n";
import { descriptionLength } from "../lib/hidden";
import {
  MAX_LENGTH,
  MIN_REPOST_SEC,
  durationLabel,
  toLocalInput,
} from "../lib/format";
import { EmojiPopover } from "./EmojiPopover";

interface ComposerProps {
  draft: Draft;
  submitting: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onOpenSheet: (sheet: "audience" | "duration" | "music") => void;
  onSubmit: () => void;
  t: T;
}

const AudienceIcon: React.FC<{ value: Audience }> = ({ value }) => {
  if (value === "PUBLIC") return <IoEarth size={14} />;
  if (value === "CONTACTS") return <IoPeopleCircle size={14} />;
  if (value === "CUSTOM") return <IoLockClosed size={14} />;
  return <IoPeople size={14} />;
};

export const Composer: React.FC<ComposerProps> = ({
  draft,
  submitting,
  onChange,
  onOpenSheet,
  onSubmit,
  t,
}) => {
  const [emojiTarget, setEmojiTarget] = useState<"text" | "secret" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    draft.scheduleEnabled || draft.repostEnabled
  );
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const secretRef = useRef<HTMLInputElement | null>(null);

  const usedLength = descriptionLength(
    draft.text,
    draft.secretEnabled ? draft.secret : ""
  );
  const pct = Math.min(100, (usedLength / MAX_LENGTH) * 100);
  const overLimit = usedLength > MAX_LENGTH;

  // Ring progress (r = 9 -> circumference ~ 56.5)
  const C = 2 * Math.PI * 9;
  const dashOffset = C - (pct / 100) * C;
  const ringClass = overLimit ? "danger" : pct > 80 ? "warn" : "ok";

  const insertEmoji = (emoji: string) => {
    if (emojiTarget === "secret") {
      const el = secretRef.current;
      const start = el?.selectionStart ?? draft.secret.length;
      const end = el?.selectionEnd ?? draft.secret.length;
      const next = draft.secret.slice(0, start) + emoji + draft.secret.slice(end);
      onChange({ secret: next });
    } else {
      const el = textRef.current;
      const start = el?.selectionStart ?? draft.text.length;
      const end = el?.selectionEnd ?? draft.text.length;
      const next = draft.text.slice(0, start) + emoji + draft.text.slice(end);
      onChange({ text: next });
    }
    setEmojiTarget(null);
  };

  const audienceChipLabel = (() => {
    if (draft.audience === "CUSTOM" && draft.friends.length > 0) {
      return t("audience.customCount", { count: draft.friends.length });
    }
    return t(`audience.${draft.audience}` as const);
  })();

  const canRepost = draft.duration >= MIN_REPOST_SEC;

  return (
    <div className="composer-card">
      {/* Main note input */}
      <div className="textarea-wrap">
        <textarea
          ref={textRef}
          className="composer-textarea"
          rows={3}
          placeholder={t("compose.placeholder")}
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
        />

        {/* Inline toolbar: Emoji + Secret toggle + Circular char counter */}
        <div className="textarea-bar">
          <div className="bar-left">
            <button
              type="button"
              className="tool-btn"
              onClick={() => setEmojiTarget("text")}
              title={t("compose.emoji")}
            >
              <IoHappy size={16} />
            </button>
            <button
              type="button"
              className={`tool-pill ${draft.secretEnabled ? "active" : ""}`}
              onClick={() =>
                onChange({
                  secretEnabled: !draft.secretEnabled,
                  secret: draft.secretEnabled ? "" : draft.secret,
                })
              }
            >
              <IoLockClosed size={12} />
              <span>{t("compose.secret")}</span>
            </button>
          </div>

          <div className={`char-meter ${ringClass}`} title={`${usedLength} / ${MAX_LENGTH}`}>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <circle className="ring-track" cx="11" cy="11" r="9" />
              <circle
                className="ring-fill"
                cx="11"
                cy="11"
                r="9"
                strokeDasharray={C}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className="char-num">
              {usedLength}/{MAX_LENGTH}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden message drawer */}
      {draft.secretEnabled && (
        <div className="secret-box">
          <div className="secret-input-row">
            <IoLockClosed size={14} className="secret-icon" />
            <input
              ref={secretRef}
              type="text"
              placeholder={t("compose.secretPlaceholder")}
              value={draft.secret}
              onChange={(e) => onChange({ secret: e.target.value })}
            />
            <button
              type="button"
              className="tool-btn"
              onClick={() => setEmojiTarget("secret")}
              title={t("compose.emoji")}
            >
              <IoHappy size={15} />
            </button>
            {draft.secret && (
              <button
                type="button"
                className="tool-btn"
                onClick={() => onChange({ secret: "" })}
              >
                <IoClose size={14} />
              </button>
            )}
          </div>
          <div className="secret-hint">{t("compose.secretCost")}</div>
        </div>
      )}

      {/* Action chips: Audience · Duration · Music */}
      <div className="chips-row">
        <button
          type="button"
          className="option-chip"
          onClick={() => onOpenSheet("audience")}
        >
          <AudienceIcon value={draft.audience} />
          <span>{audienceChipLabel}</span>
        </button>

        <button
          type="button"
          className="option-chip"
          onClick={() => onOpenSheet("duration")}
        >
          <IoTime size={14} />
          <span>{durationLabel(draft.duration)}</span>
        </button>

        <button
          type="button"
          className={`option-chip music ${draft.music ? "has-music" : ""}`}
          onClick={() => onOpenSheet("music")}
        >
          <IoMusicalNotes size={14} />
          <span className="chip-ellipsis">
            {draft.music ? draft.music.title : t("compose.addMusic")}
          </span>
          {draft.music && (
            <span
              role="button"
              tabIndex={0}
              className="chip-clear"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ music: null, trimStartMs: 0 });
              }}
            >
              <IoClose size={12} />
            </span>
          )}
        </button>
      </div>

      {/* Collapsible advanced options: Schedule + Auto-repost */}
      <div className="advanced-wrap">
        <button
          type="button"
          className={`advanced-toggle ${showAdvanced ? "open" : ""}`}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <span>{t("compose.advanced")}</span>
          {(draft.scheduleEnabled || draft.repostEnabled) && <span className="dot-active" />}
          <IoChevronForward size={13} className="chev" />
        </button>

        {showAdvanced && (
          <div className="advanced-body">
            {/* Schedule option */}
            <div className="adv-block">
              <label className="adv-head">
                <span className="adv-title">
                  <IoCalendar size={14} />
                  <span>{t("compose.schedule")}</span>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={draft.scheduleEnabled}
                  onChange={(e) =>
                    onChange({
                      scheduleEnabled: e.target.checked,
                      scheduleAt:
                        draft.scheduleAt || toLocalInput(Date.now() + 60 * 60 * 1000),
                    })
                  }
                />
              </label>
              {draft.scheduleEnabled && (
                <div className="adv-sub">
                  <input
                    type="datetime-local"
                    className="input-sm"
                    value={draft.scheduleAt}
                    min={toLocalInput(Date.now() + 60 * 1000)}
                    onChange={(e) => onChange({ scheduleAt: e.target.value })}
                  />
                  <small className="muted">{t("compose.scheduleHint")}</small>
                </div>
              )}
            </div>

            {/* Auto-repost option */}
            <div className="adv-block">
              <label className="adv-head">
                <span className="adv-title">
                  <IoRepeat size={14} />
                  <span>{t("compose.repost")}</span>
                </span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={draft.repostEnabled && canRepost}
                  disabled={!canRepost}
                  onChange={(e) => onChange({ repostEnabled: e.target.checked })}
                />
              </label>
              {!canRepost ? (
                <small className="muted">{t("compose.repostHint")}</small>
              ) : (
                draft.repostEnabled && (
                  <div className="adv-sub row">
                    <span>{t("compose.repostTimes")}</span>
                    <div className="seg-group">
                      {[1, 2, 3, 5, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`seg-btn ${draft.repostTimes === n ? "active" : ""}`}
                          onClick={() => onChange({ repostTimes: n })}
                        >
                          {n}×
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Primary Share / Schedule button */}
      <button
        type="button"
        className="btn-share"
        disabled={submitting || overLimit}
        onClick={onSubmit}
        title={t("compose.shortcut")}
      >
        {submitting ? (
          <span>{t("compose.sending")}</span>
        ) : draft.scheduleEnabled ? (
          <>
            <IoCalendar size={16} />
            <span>{t("compose.scheduleBtn")}</span>
          </>
        ) : (
          <>
            <IoSend size={15} />
            <span>{t("compose.share")}</span>
          </>
        )}
      </button>

      {emojiTarget && (
        <EmojiPopover onPick={insertEmoji} onClose={() => setEmojiTarget(null)} />
      )}
    </div>
  );
};
