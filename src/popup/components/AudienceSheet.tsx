import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IoAdd,
  IoBookmark,
  IoCheckmark,
  IoClose,
  IoEarth,
  IoLockClosed,
  IoPeople,
  IoPeopleCircle,
  IoPersonCircle,
  IoSearch,
  IoTrash,
} from "react-icons/io5";
import type { Audience, Friend, FriendGroup } from "../types";
import type { T } from "../lib/i18n";
import { api } from "../lib/storage";
import { uid } from "../lib/format";
import { Sheet } from "./Sheet";

interface AudienceSheetProps {
  audience: Audience;
  friends: Friend[];
  groups: FriendGroup[];
  onChangeAudience: (a: Audience) => void;
  onChangeFriends: (f: Friend[]) => void;
  onChangeGroups: (g: FriendGroup[] | ((prev: FriendGroup[]) => FriendGroup[])) => void;
  onToast: (msg: string) => void;
  onClose: () => void;
  t: T;
}

const OPTIONS: { value: Audience; icon: React.ReactNode }[] = [
  { value: "FRIENDS", icon: <IoPeople size={18} /> },
  { value: "PUBLIC", icon: <IoEarth size={18} /> },
  { value: "CONTACTS", icon: <IoPeopleCircle size={18} /> },
  { value: "CUSTOM", icon: <IoLockClosed size={18} /> },
];

export const AudienceSheet: React.FC<AudienceSheetProps> = ({
  audience,
  friends,
  groups,
  onChangeAudience,
  onChangeFriends,
  onChangeGroups,
  onToast,
  onClose,
  t,
}) => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const loadFriends = useCallback(async (q: string, nextCursor: string | null) => {
    setLoading(true);
    const res = await api.searchFriends(q, nextCursor, 24);
    setLoading(false);
    if (!res.success) return;
    const incoming = res.items || [];
    setItems((prev) => {
      if (!nextCursor) return incoming;
      const map = new Map(prev.map((i) => [i.id, i]));
      incoming.forEach((i) => map.set(i.id, i));
      return Array.from(map.values());
    });
    setCursor(res.nextCursor ?? null);
    setHasNext(Boolean(res.hasNextPage));
  }, []);

  // Debounced search when CUSTOM is active
  useEffect(() => {
    if (audience !== "CUSTOM") return;
    const timer = setTimeout(() => {
      loadFriends(query, null);
    }, 260);
    return () => clearTimeout(timer);
  }, [audience, query, loadFriends]);

  const toggleFriend = (f: Friend) => {
    if (selectedIds.has(f.id)) {
      onChangeFriends(friends.filter((x) => x.id !== f.id));
    } else {
      onChangeFriends([f, ...friends]);
    }
  };

  const applyGroup = (g: FriendGroup) => {
    onChangeAudience("CUSTOM");
    onChangeFriends(g.friends);
  };

  const handleSaveGroup = () => {
    const name = groupName.trim();
    if (!name || friends.length === 0) return;
    onChangeGroups((prev) => [{ id: uid(), name, friends }, ...prev]);
    setGroupName("");
    setSavingGroup(false);
    onToast(t("toast.groupSaved"));
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loading || !hasNext || !cursor) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadFriends(query, cursor);
    }
  };

  return (
    <Sheet
      title={t("audience.title")}
      onClose={onClose}
      rightAction={
        <button type="button" className="btn-primary-xs" onClick={onClose}>
          {t("common.done")}
        </button>
      }
    >
      <div className="radio-grid">
        {OPTIONS.map((opt) => {
          const active = audience === opt.value;
          const labelKey = `audience.${opt.value}` as const;
          const descKey = `audience.${opt.value}.desc` as const;
          return (
            <button
              key={opt.value}
              type="button"
              className={`radio-card ${active ? "active" : ""}`}
              onClick={() => onChangeAudience(opt.value)}
            >
              <span className="radio-icon">{opt.icon}</span>
              <span className="radio-text">
                <strong>{t(labelKey)}</strong>
                <small>{t(descKey)}</small>
              </span>
              {active && (
                <span className="radio-check">
                  <IoCheckmark size={14} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {audience === "CUSTOM" && (
        <div className="custom-friends-box">
          {/* Saved friend groups */}
          <div className="groups-bar">
            <span className="sub-label">
              <IoBookmark size={12} /> {t("audience.groups")}
            </span>
            {friends.length > 0 && !savingGroup && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setSavingGroup(true)}
              >
                <IoAdd size={13} /> {t("audience.saveGroup")}
              </button>
            )}
          </div>

          {savingGroup && (
            <div className="group-save-row">
              <input
                type="text"
                className="input-sm"
                placeholder={t("audience.groupName")}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveGroup()}
                autoFocus
              />
              <button
                type="button"
                className="btn-primary-xs"
                onClick={handleSaveGroup}
                disabled={!groupName.trim()}
              >
                {t("audience.save")}
              </button>
              <button
                type="button"
                className="btn-ghost-xs"
                onClick={() => setSavingGroup(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {groups.length > 0 && (
            <div className="group-chips">
              {groups.map((g) => (
                <div key={g.id} className="group-chip">
                  <button type="button" className="group-chip-main" onClick={() => applyGroup(g)}>
                    <span>{g.name}</span>
                    <span className="group-chip-count">{g.friends.length}</span>
                  </button>
                  <button
                    type="button"
                    className="group-chip-del"
                    onClick={() => onChangeGroups((prev) => prev.filter((x) => x.id !== g.id))}
                    title={t("common.delete")}
                  >
                    <IoTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected friend chips */}
          {friends.length > 0 && (
            <div className="selected-friends">
              <div className="sub-label">{t("audience.selected", { count: friends.length })}</div>
              <div className="friend-chips">
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="friend-chip"
                    onClick={() => toggleFriend(f)}
                  >
                    {f.imageUri ? (
                      <img src={f.imageUri} alt="" className="chip-avatar" />
                    ) : (
                      <IoPersonCircle size={15} />
                    )}
                    <span>{f.name}</span>
                    <IoClose size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search box */}
          <div className="search-field">
            <IoSearch size={15} className="search-icon" />
            <input
              type="text"
              placeholder={t("audience.searchFriends")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery("")}>
                <IoClose size={14} />
              </button>
            )}
          </div>

          {/* Friends list */}
          <div className="picker-list" ref={listRef} onScroll={handleScroll}>
            {items.map((f) => {
              const checked = selectedIds.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`picker-row ${checked ? "active" : ""}`}
                  onClick={() => toggleFriend(f)}
                >
                  {f.imageUri ? (
                    <img src={f.imageUri} alt="" className="row-avatar" loading="lazy" />
                  ) : (
                    <div className="row-avatar fallback">
                      <IoPersonCircle size={28} />
                    </div>
                  )}
                  <span className="row-title">{f.name}</span>
                  <span className={`check-circle ${checked ? "checked" : ""}`}>
                    {checked && <IoCheckmark size={12} />}
                  </span>
                </button>
              );
            })}
            {loading && <div className="list-hint">{t("common.loading")}</div>}
            {!loading && items.length === 0 && (
              <div className="list-hint">{t("audience.noFriends")}</div>
            )}
            {!loading && hasNext && <div className="list-hint">{t("common.loadMore")}</div>}
          </div>
        </div>
      )}
    </Sheet>
  );
};
