// FB NOTE - VanIT — content script
// Finds hidden messages (invisible Unicode tag characters) inside Facebook /
// Messenger text and shows them as a small lock badge next to the visible text.
(() => {
  const START = "\u200C";
  const END = "\u{E0061}";
  // 26 digit symbols: U+E0062..U+E007A and U+E007F
  const DIGITS = [];
  for (let cp = 0xe0062; cp <= 0xe007a; cp++) DIGITS.push(String.fromCodePoint(cp));
  DIGITS.push(String.fromCodePoint(0xe007f));
  const DIGIT_MAP = new Map(DIGITS.map((d, i) => [d, i]));
  const BASE = DIGITS.length;
  const LEN = 5; // 26^5 > 0x110000
  const PATTERN = /\u200C([\u{E0062}-\u{E007A}\u{E007F}]+?)\u{E0061}/gu;
  const MARK = "data-vanit-hidden";

  const decodePayload = (payload) => {
    let out = "";
    let digits = [];
    for (const ch of payload) {
      digits.push(DIGIT_MAP.get(ch) ?? 0);
      if (digits.length === LEN) {
        let code = 0;
        for (const d of digits) code = code * BASE + d;
        if (code <= 0x10ffff) out += String.fromCodePoint(code);
        digits = [];
      }
    }
    return out;
  };

  const LOCK_SVG =
    '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" style="flex-shrink:0"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"/></svg>';

  const makeBadge = (text) => {
    const badge = document.createElement("span");
    badge.setAttribute(MARK, "1");
    badge.title = "Tin nhắn ẩn — FB NOTE by VanIT";
    badge.style.cssText = [
      "display:inline-flex", "align-items:center", "gap:4px", "margin:0 2px",
      "padding:1px 8px", "border-radius:999px", "font-size:0.92em", "line-height:1.5",
      "background:linear-gradient(135deg,rgba(8,102,255,.16),rgba(131,58,255,.16))",
      "color:#5b8cff", "font-weight:600", "white-space:pre-wrap", "vertical-align:baseline",
    ].join(";");
    badge.innerHTML = LOCK_SVG;
    badge.appendChild(document.createTextNode(text));
    return badge;
  };

  const isEditable = (node) => {
    const el = node.parentElement;
    return !el || el.closest("textarea,input,[contenteditable='true'],[" + MARK + "]");
  };

  const processTextNode = (node) => {
    const text = node.nodeValue;
    if (!text || !text.includes(START) || isEditable(node)) return;
    PATTERN.lastIndex = 0;
    if (!PATTERN.test(text)) return;
    PATTERN.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    for (const match of text.matchAll(PATTERN)) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      const secret = decodePayload(match[1]);
      if (secret) frag.appendChild(makeBadge(secret));
      last = match.index + match[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode && node.parentNode.replaceChild(frag, node);
  };

  const scan = (root) => {
    if (root.nodeType === Node.TEXT_NODE) return processTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue && n.nodeValue.includes(START) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  };

  let observer = null;
  const start = () => {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") processTextNode(m.target);
        else m.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(document.body);
  };
  const stop = () => {
    if (observer) observer.disconnect();
    observer = null;
  };

  chrome.storage.local.get(["observerEnabled"], (res) => {
    if (res.observerEnabled !== false) start();
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.observerEnabled) changes.observerEnabled.newValue === false ? stop() : start();
  });
})();
