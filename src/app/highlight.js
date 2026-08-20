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

const ESCAPED_BRACKETS = ['{', '}', '[', ']'];

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
 * Check if text is valid JSON.
 */
export function isValidJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Split JSON-like text into tokens. Every character of the input ends up in exactly
 * one token, so joining the values reproduces the input byte for byte.
 * Works on both valid and invalid JSON, always applying syntax highlighting.
 */
export function tokenizeJson(text) {
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
      // always advance at least one character to avoid infinite loops on
      // partial keywords like 't' that match STARTS_VALUE but aren't complete
      i++;
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
 * Find the end of an escaped string (starts with \", ends with \" not preceded by \\)
 */
function endOfEscapedString(text, start) {
  let i = start + 2; // skip the opening \"
  while (i < text.length) {
    if (text[i] === '\\' && text[i + 1] === '"') {
      return i + 2; // found closing \"
    }
    if (text[i] === '\\' && text[i + 1] === '\\') {
      i += 2; // skip escaped backslash
    } else {
      i++;
    }
  }
  return i;
}

/**
 * Check if an escaped string is a key (next non-whitespace is :)
 */
function isEscapedKey(text, afterString) {
  let i = afterString;
  while (i < text.length && /\s/.test(text[i])) i++;
  return text[i] === ':';
}

/**
 * Tokenize escaped JSON (output from JSON.stringify(JSON.stringify(x)).slice(1,-1))
 * Handles escaped quotes \" for strings while brackets remain unescaped.
 */
export function tokenizeEscapedJson(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const start = i;
    const ch = text[i];

    // Check for escaped string: \"...\"
    if (text[i] === '\\' && text[i + 1] === '"') {
      i = endOfEscapedString(text, i);
      tokens.push({
        type: isEscapedKey(text, i) ? 'key' : 'string',
        value: text.slice(start, i)
      });
    } else if (ESCAPED_BRACKETS.includes(ch)) {
      // Brackets are not escaped in JSON strings
      i++;
      tokens.push({ type: 'bracket', value: ch });
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      // Numbers
      i++;
      while (i < text.length && /[0-9eE+.\-]/.test(text[i])) i++;
      tokens.push({ type: 'number', value: text.slice(start, i) });
    } else if (text.startsWith('true', i) || text.startsWith('false', i)) {
      i += ch === 't' ? 4 : 5;
      tokens.push({ type: 'boolean', value: text.slice(start, i) });
    } else if (text.startsWith('null', i)) {
      i += 4;
      tokens.push({ type: 'null', value: text.slice(start, i) });
    } else {
      // Punctuation (: ,) and whitespace
      i++;
      while (i < text.length &&
             !(text[i] === '\\' && text[i + 1] === '"') &&
             !ESCAPED_BRACKETS.includes(text[i]) &&
             !/[\-0-9tfn]/.test(text[i])) {
        i++;
      }
      tokens.push({ type: 'plain', value: text.slice(start, i) });
    }
  }

  return tokens;
}

/**
 * Replace the element's children with highlighted markup.
 * Always applies syntax highlighting regardless of JSON validity.
 * Returns true if the text is valid JSON.
 * Caller is responsible for saving and restoring the caret.
 */
export function paint(el, text) {
  const valid = isValidJson(text);
  const tokens = tokenizeJson(text);
  // valid JSON is balanced by definition, so this only ever finds something
  // once an edit has broken the structure
  const unmatched = valid ? null : unmatchedBrackets(text);

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
  return valid;
}

/**
 * Replace the element's children with highlighted markup for escaped JSON.
 * Uses the escaped JSON tokenizer which handles \" delimited strings.
 */
export function paintEscaped(el, text) {
  const tokens = tokenizeEscapedJson(text);

  const fragment = el.ownerDocument.createDocumentFragment();

  for (const token of tokens) {
    const className = CLASS_BY_TYPE[token.type];
    if (!className) {
      fragment.appendChild(el.ownerDocument.createTextNode(token.value));
    } else {
      const span = el.ownerDocument.createElement('span');
      span.className = className;
      span.textContent = token.value;
      fragment.appendChild(span);
    }
  }

  el.replaceChildren(fragment);
}
