import React, { useState } from "react";

interface EmojiPopoverProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

const GROUPS: { icon: string; items: string[] }[] = [
  {
    icon: "😀",
    items: [
      "😀","😃","😄","😁","😆","🥹","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰",
      "😘","😗","😙","😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔",
      "😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤯","😳","🥵",
      "🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄",
      "🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒",
    ],
  },
  {
    icon: "❤️",
    items: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓",
      "💗","💖","💘","💝","💟","✨","🌟","💫","⭐","🔥","💥","💯","💢","💦","💨","🕊️",
      "🦋","🌸","🌺","🌻","🌼","🌷","🌹","🥀","🍀","🌿","🌱","☀️","🌤️","🌙","⭐","🌈",
    ],
  },
  {
    icon: "👍",
    items: [
      "👍","👎","👊","✊","🤛","🤜","🤞","✌️","🤟","🤘","👌","🤌","🤏","👈","👉","👆",
      "👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","💪","🙏","🤝","👏","🙌","👐","🤲","🫶",
      "🫡","🫂","👀","🫀","🧠","👑","💍","🎀","🎁","🎈","🎉","🎊","🎂","☕","🧋","🍻",
    ],
  },
  {
    icon: "🎵",
    items: [
      "🎵","🎶","🎧","🎤","🎸","🎹","🥁","🎷","🎺","🎻","🎬","🎮","🎯","🎲","🎳","🏆",
      "🥇","⚡","🚀","✈️","🏖️","🏝️","🏔️","🌃","🌆","🌇","🌉","🌌","📸","💡","🔮","🧿",
      "🧸","📌","📎","🔒","🔓","💎","🪙","💸","⏰","⏳","💤","💬","💭","🗯️","📢","🔔",
    ],
  },
];

export const EmojiPopover: React.FC<EmojiPopoverProps> = ({ onPick, onClose }) => {
  const [tab, setTab] = useState(0);

  return (
    <div className="emoji-backdrop" onClick={onClose}>
      <div className="emoji-popover" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-tabs">
          {GROUPS.map((g, idx) => (
            <button
              key={idx}
              type="button"
              className={`emoji-tab ${tab === idx ? "active" : ""}`}
              onClick={() => setTab(idx)}
            >
              {g.icon}
            </button>
          ))}
        </div>
        <div className="emoji-grid">
          {GROUPS[tab].items.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              className="emoji-cell"
              onClick={() => onPick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
