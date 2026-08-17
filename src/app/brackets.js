// Bracket pair matching for the editable output box.
//
// This deliberately does not require valid JSON — a half-finished edit is
// exactly when you want to see which brace pairs with which.

export const BRACKETS = '{}[]';

const CLOSER_FOR = { '{': '}', '[': ']' };
const OPENER_FOR = { '}': '{', ']': '[' };

const isOpener = (ch) => ch in CLOSER_FOR;
const isCloser = (ch) => ch in OPENER_FOR;

/**
 * Mark every character that sits inside a string literal (quotes included), so
 * structural scanning can ignore braces that are just string content. Works on
 * malformed text too — an unterminated string simply runs to the end.
 *
 * A backslash escapes the next character outside strings as well: that never
 * happens in real JSON, but it is exactly what the escaped output looks like
 * ({\"a\": 1}), and it keeps those braces pairing up correctly.
 */
export function stringMask(text) {
  const mask = new Uint8Array(text.length);
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      mask[i] = inString ? 1 : 0;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      mask[i] = inString ? 1 : 0;
    } else if (inString) {
      mask[i] = 1;
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      mask[i] = 1;
      inString = true;
    }
  }
  return mask;
}

/**
 * Indices of every bracket that has no partner — an unclosed opener, or a
 * closer with nothing (or the wrong thing) open. Best effort on broken text,
 * which is the only place it can find anything.
 */
export function unmatchedBrackets(text) {
  const mask = stringMask(text);
  const open = [];
  const unmatched = new Set();

  for (let i = 0; i < text.length; i++) {
    if (mask[i]) continue;
    const ch = text[i];
    if (isOpener(ch)) {
      open.push(i);
    } else if (isCloser(ch)) {
      if (open.length && text[open[open.length - 1]] === OPENER_FOR[ch]) open.pop();
      else unmatched.add(i); // nothing open, or the wrong kind
    }
  }
  for (const i of open) unmatched.add(i); // never closed

  return unmatched;
}

// walk outwards from `from` counting depth, ignoring brackets inside strings
function scan(text, mask, from, step) {
  const want = step > 0 ? CLOSER_FOR[text[from]] : OPENER_FOR[text[from]];
  let depth = 0;

  for (let i = from; i >= 0 && i < text.length; i += step) {
    if (mask[i]) continue;
    const ch = text[i];
    if (!BRACKETS.includes(ch)) continue;

    // the bracket we started from always opens the count
    if ((step > 0 ? isOpener(ch) : isCloser(ch))) {
      depth++;
    } else {
      depth--;
      if (depth === 0) return ch === want ? i : -1; // -1 when the types don't agree
    }
  }
  return -1;
}

/**
 * Find the bracket pair adjacent to the caret, checking the character before
 * the caret first (so it lights up right after you type a closing brace).
 * Returns [openIndex, closeIndex], or null when there is no bracket next to
 * the caret or it has no match.
 */
export function matchBracket(text, caret) {
  if (caret == null) return null;
  const mask = stringMask(text);

  for (const pos of [caret - 1, caret]) {
    if (pos < 0 || pos >= text.length || mask[pos]) continue;
    const ch = text[pos];

    if (isOpener(ch)) {
      const close = scan(text, mask, pos, 1);
      return close === -1 ? null : [pos, close];
    }
    if (isCloser(ch)) {
      const open = scan(text, mask, pos, -1);
      return open === -1 ? null : [open, pos];
    }
  }
  return null;
}

// character offset of each rendered bracket span, in document order
function bracketSpansByOffset(el) {
  const spans = new Map();
  let offset = 0;
  for (const node of el.childNodes) {
    if (node.nodeType === 1 && node.classList.contains('tok-bracket')) spans.set(offset, node);
    offset += node.textContent.length;
  }
  return spans;
}

/**
 * Light up the bracket pair around `caret` (pass null to clear). Only toggles
 * classes — the DOM structure is untouched, so the caret and the undo stack
 * survive. Returns the matched pair, or null.
 */
export function showBracketMatch(el, caret) {
  for (const span of el.querySelectorAll('.tok-bracket-match')) {
    span.classList.remove('tok-bracket-match');
  }

  const text = el.textContent ?? '';
  const match = matchBracket(text, caret);
  if (!match) return null;

  const spans = bracketSpansByOffset(el);
  for (const pos of match) {
    const span = spans.get(pos);
    // a bracket typed since the last repaint has no span yet; it lights up then
    if (span && span.textContent === text[pos]) span.classList.add('tok-bracket-match');
  }
  return match;
}
