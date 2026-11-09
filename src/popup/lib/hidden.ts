// Hidden-message codec. Must stay compatible with public/content.js.
// Each code point -> 5 base-26 digits made of invisible Unicode tag characters,
// wrapped between U+200C and U+E0061.

const START = "\u200C";
const END = "\u{E0061}";
const DIGITS: string[] = [];
for (let cp = 0xe0062; cp <= 0xe007a; cp++) DIGITS.push(String.fromCodePoint(cp));
DIGITS.push(String.fromCodePoint(0xe007f));
const DIGIT_MAP = new Map(DIGITS.map((d, i) => [d, i]));
const BASE = DIGITS.length; // 26
const LEN = 5;
const PATTERN = /\u200C([\u{E0062}-\u{E007A}\u{E007F}]+?)\u{E0061}/u;

export function encodeHidden(secret: string): string {
  if (!secret) return "";
  let out = START;
  for (const ch of secret) {
    let code = ch.codePointAt(0)!;
    const digits: string[] = [];
    for (let i = 0; i < LEN; i++) {
      digits.unshift(DIGITS[code % BASE]);
      code = Math.floor(code / BASE);
    }
    out += digits.join("");
  }
  return out + END;
}

function decodePayload(payload: string): string {
  let out = "";
  let digits: number[] = [];
  for (const ch of payload) {
    digits.push(DIGIT_MAP.get(ch) ?? 0);
    if (digits.length === LEN) {
      const code = digits.reduce((acc, d) => acc * BASE + d, 0);
      if (code <= 0x10ffff) out += String.fromCodePoint(code);
      digits = [];
    }
  }
  return out;
}

/** Splits a note description into its visible text and hidden secret. */
export function splitHidden(full: string | null | undefined): { visible: string; secret: string } {
  if (!full) return { visible: "", secret: "" };
  const match = PATTERN.exec(full);
  if (!match) return { visible: full, secret: "" };
  const visible = (full.slice(0, match.index) + full.slice(match.index + match[0].length)).trim();
  return { visible, secret: decodePayload(match[1]) };
}

export function buildDescription(text: string, secret: string): string {
  const visible = text.trim();
  const hidden = secret.trim() ? encodeHidden(secret.trim()) : "";
  // Facebook trims whitespace-only notes, so a secret needs at least one visible char.
  if (hidden && !visible) return "\u200B" + hidden;
  return visible + hidden;
}

/** Description length as Facebook's API sees it (UTF-16 units). */
export const descriptionLength = (text: string, secret: string) => buildDescription(text, secret).length;
