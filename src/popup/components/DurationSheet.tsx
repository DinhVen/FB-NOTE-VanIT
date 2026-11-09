import React, { useState } from "react";
import { IoCheckmark, IoTime } from "react-icons/io5";
import type { T } from "../lib/i18n";
import { MAX_DURATION_SEC, formatDateTime } from "../lib/format";
import { Sheet } from "./Sheet";

interface DurationSheetProps {
  duration: number;
  lang: string;
  onChange: (sec: number) => void;
  onClose: () => void;
  t: T;
}

const PRESETS: { label: string; seconds: number }[] = [
  { label: "30m", seconds: 30 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "3h", seconds: 3 * 3600 },
  { label: "6h", seconds: 6 * 3600 },
  { label: "12h", seconds: 12 * 3600 },
  { label: "24h", seconds: 24 * 3600 },
  { label: "3d", seconds: 3 * 86400 },
  { label: "7d", seconds: 7 * 86400 },
];

type Unit = "m" | "h" | "d";

export const DurationSheet: React.FC<DurationSheetProps> = ({
  duration,
  lang,
  onChange,
  onClose,
  t,
}) => {
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>("h");

  const applyCustom = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    const factor = unit === "d" ? 86400 : unit === "h" ? 3600 : 60;
    const sec = Math.min(Math.max(60, Math.round(n * factor)), MAX_DURATION_SEC);
    onChange(sec);
    setAmount("");
  };

  const expiresAt = formatDateTime(Date.now() + duration * 1000, lang);

  return (
    <Sheet
      title={t("duration.title")}
      onClose={onClose}
      rightAction={
        <button type="button" className="btn-primary-xs" onClick={onClose}>
          <IoCheckmark size={14} /> {t("common.done")}
        </button>
      }
    >
      <div className="preset-grid">
        {PRESETS.map((p) => {
          const active = duration === p.seconds;
          return (
            <button
              key={p.seconds}
              type="button"
              className={`preset-btn ${active ? "active" : ""}`}
              onClick={() => onChange(p.seconds)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="field-block">
        <div className="sub-label">
          {t("duration.custom")} · <span className="muted">{t("duration.max")}</span>
        </div>
        <div className="custom-duration-row">
          <input
            type="number"
            min="1"
            step="1"
            className="input-sm"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
          />
          <div className="seg-group">
            {(["m", "h", "d"] as Unit[]).map((u) => (
              <button
                key={u}
                type="button"
                className={`seg-btn ${unit === u ? "active" : ""}`}
                onClick={() => setUnit(u)}
              >
                {u === "m"
                  ? t("duration.minutes")
                  : u === "h"
                    ? t("duration.hours")
                    : t("duration.days")}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary-xs"
            onClick={applyCustom}
            disabled={!amount}
          >
            {t("duration.apply")}
          </button>
        </div>
      </div>

      <div className="expiry-banner">
        <IoTime size={15} />
        <span>{t("duration.expiresAt", { time: expiresAt })}</span>
      </div>
    </Sheet>
  );
};
