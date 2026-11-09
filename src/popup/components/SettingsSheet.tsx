import React from "react";
import { IoCheckmark, IoEye, IoLanguage, IoMoon, IoSunny } from "react-icons/io5";
import type { Lang, Settings, ThemeMode } from "../types";
import type { T } from "../lib/i18n";
import { Sheet } from "./Sheet";

interface SettingsSheetProps {
  settings: Settings;
  observerEnabled: boolean;
  onChangeSettings: (next: Settings) => void;
  onChangeObserver: (v: boolean) => void;
  onClose: () => void;
  t: T;
}

const THEMES: { value: ThemeMode; icon: React.ReactNode }[] = [
  { value: "system", icon: <IoSunny size={14} /> },
  { value: "light", icon: <IoSunny size={14} /> },
  { value: "dark", icon: <IoMoon size={14} /> },
];

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  settings,
  observerEnabled,
  onChangeSettings,
  onChangeObserver,
  onClose,
  t,
}) => {
  return (
    <Sheet
      title={t("settings.title")}
      onClose={onClose}
      rightAction={
        <button type="button" className="btn-primary-xs" onClick={onClose}>
          <IoCheckmark size={14} /> {t("common.done")}
        </button>
      }
    >
      <div className="field-block">
        <div className="sub-label">{t("settings.theme")}</div>
        <div className="seg-group full">
          {THEMES.map((th) => (
            <button
              key={th.value}
              type="button"
              className={`seg-btn ${settings.theme === th.value ? "active" : ""}`}
              onClick={() => onChangeSettings({ ...settings, theme: th.value })}
            >
              {th.icon}
              <span>{t(`settings.theme.${th.value}` as const)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field-block">
        <div className="sub-label">
          <IoLanguage size={13} /> {t("settings.lang")}
        </div>
        <div className="seg-group full">
          {(["vi", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`seg-btn ${settings.lang === l ? "active" : ""}`}
              onClick={() => onChangeSettings({ ...settings, lang: l })}
            >
              {l === "vi" ? "Tiếng Việt" : "English"}
            </button>
          ))}
        </div>
      </div>

      <label className="toggle-row">
        <span className="toggle-icon">
          <IoEye size={17} />
        </span>
        <span className="toggle-text">
          <strong>{t("settings.reveal")}</strong>
          <small>{t("settings.revealDesc")}</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={observerEnabled}
          onChange={(e) => onChangeObserver(e.target.checked)}
        />
      </label>

      <div className="about-foot">{t("settings.about", { version: "v2.0" })}</div>
    </Sheet>
  );
};
