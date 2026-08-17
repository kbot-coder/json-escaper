// JSON syntax highlighting for the editable output box.
//
// tokenizeJson() only returns tokens when the text actually parses as JSON, so
// half-finished edits (and escaped one-line output) simply render unstyled
// instead of flickering through nonsense colours.

import { BRACKETS, stringMask, unmatchedBrackets } from './brackets.js';

const CLASS_BY_TYPE = {
  key: 'tok-key',
  string: 'tok-string',
  number: 'tok-number',
  boolean: 'tok-boolean',
  null: 'tok-null',
  bracket: 'tok-bracket',
};

// characters that can begin a JSON value; anything else is punctuation/whitespace
const STARTS_VALUE = /["\-0-9tfn]/;

function endOfString(text, start) {
  let i = start + 1; // skip the opening quote
  while (i < text.length) {
    if (text[i] === '\\') i += 2;
    else if (text[i] === '"') return i + 1;
    else i++;
  }
  return i;
}

// a string is a key when the next non-whitespace character is a colon
function isKey(text, afterString) {
  let i = afterString;
  while (i < text.length && /\s/.test(text[i])) i++;
  return text[i] === ':';
}

/**
 * Split JSON text into tokens. Every character of the input ends up in exactly
 * one token, so joining the values reproduces the input byte for byte.
 * Returns null when the text is not valid JSON.
 */
export function tokenizeJson(text) {
  try {
    JSON.parse(text);
  } catch {
    return null;
  }

  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const start = i;
    const ch = text[i];

    if (ch === '"') {
      i = endOfString(text, i);
      tokens.push({ type: isKey(text, i) ? 'key' : 'string', value: text.slice(start, i) });
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      i++;
      while (i < text.length && /[0-9eE+.\-]/.test(text[i])) i++;
      tokens.push({ type: 'number', value: text.slice(start, i) });
    } else if (text.startsWith('true', i) || text.startsWith('false', i)) {
      i += ch === 't' ? 4 : 5;
      tokens.push({ type: 'boolean', value: text.slice(start, i) });
    } else if (text.startsWith('null', i)) {
      i += 4;
      tokens.push({ type: 'null', value: text.slice(start, i) });
    } else if (BRACKETS.includes(ch)) {
      // one token per bracket so a matching pair can be lit up individually
      i++;
      tokens.push({ type: 'bracket', value: ch });
    } else {
      // punctuation, whitespace and indentation, kept as one run
      while (i < text.length && !STARTS_VALUE.test(text[i]) && !BRACKETS.includes(text[i])) i++;
      tokens.push({ type: 'plain', value: text.slice(start, i) });
    }
  }

  return tokens;
}

/**
 * Fallback for text that is not valid JSON: no syntax colours, but brackets
 * still get their own token so bracket matching keeps working mid-edit.
 */
export function bracketTokens(text) {
  const mask = stringMask(text);
  const tokens = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (mask[i] || !BRACKETS.includes(text[i])) continue;
    if (i > start) tokens.push({ type: 'plain', value: text.slice(start, i) });
    tokens.push({ type: 'bracket', value: text[i] });
    start = i + 1;
  }
  if (start < text.length) tokens.push({ type: 'plain', value: text.slice(start) });

  return tokens;
}

/**
 * Replace the element's children with highlighted markup, or with plain text
 * when the content is not valid JSON. Returns true if it highlighted.
 * Caller is responsible for saving and restoring the caret.
 */
export function paint(el, text) {
  const highlighted = tokenizeJson(text);
  const tokens = highlighted ?? bracketTokens(text);
  // valid JSON is balanced by definition, so this only ever finds something
  // once an edit has broken the structure
  const unmatched = highlighted ? null : unmatchedBrackets(text);

  const fragment = el.ownerDocument.createDocumentFragment();
  let offset = 0;

  for (const token of tokens) {
    const className = CLASS_BY_TYPE[token.type];
    if (!className) {
      fragment.appendChild(el.ownerDocument.createTextNode(token.value));
    } else {
      const span = el.ownerDocument.createElement('span');
      span.className = className;
      if (token.type === 'bracket' && unmatched?.has(offset)) {
        span.classList.add('tok-bracket-unmatched');
      }
      span.textContent = token.value;
      fragment.appendChild(span);
    }
    offset += token.value.length;
  }

  el.replaceChildren(fragment);
  return highlighted !== null;
}
