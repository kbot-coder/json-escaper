// Pure text-editing logic for the editable output box.
//
// Each function takes the full text plus the selection offsets and returns an
// edit descriptor — { from, to, insert, caret } — describing the text range to
// replace, what to put there, and where the caret should land afterwards.
// Returning null means "do nothing".

// Use whatever the document is already indented with (escaped output is
// tab-indented, but pasted JSON is often spaces).
export function detectUnit(text) {
  const match = text.match(/\n([ \t]+)\S/);
  if (!match) return '\t';
  return match[1][0] === '\t' ? '\t' : match[1];
}

export const leadingWhitespace = (line) => line.match(/^[ \t]*/)[0];

const lineStartAt = (text, offset) => text.lastIndexOf('\n', offset - 1) + 1;

// Indentation a line should have based on the closest non-blank line above it.
export function indentFromPreviousLine(text, lineStart, unit) {
  const previous = text
    .slice(0, Math.max(lineStart - 1, 0))
    .split('\n')
    .reverse()
    .find((line) => line.trim() !== '');
  if (previous === undefined) return '';
  const indent = leadingWhitespace(previous);
  return /[{[]\s*$/.test(previous) ? indent + unit : indent;
}

// Enter keeps the current line's indentation instead of dropping the caret to
// column zero, and goes one level deeper when the line opens a block.
export function enterEdit(text, start, end) {
  const unit = detectUnit(text);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const indent = leadingWhitespace(before.slice(lineStartAt(text, start)));
  const opensBlock = /[{[][ \t]*$/.test(before);
  const closesBlock = /^[ \t]*[}\]]/.test(after);

  const head = '\n' + (opensBlock ? indent + unit : indent);
  // Enter pressed between `{` and `}` drops the closing brace onto its own line
  const tail = opensBlock && closesBlock ? '\n' + indent : '';

  return { from: start, to: end, insert: head + tail, caret: start + head.length };
}

// Tab on an otherwise blank line snaps it to where the line above sits;
// anywhere else it inserts one indent level.
export function tabEdit(text, start, end) {
  const unit = detectUnit(text);
  const lineStart = lineStartAt(text, start);
  const linePrefix = text.slice(lineStart, start);

  if (start === end && /^[ \t]*$/.test(linePrefix)) {
    const target = indentFromPreviousLine(text, lineStart, unit);
    if (target.length > linePrefix.length) {
      return { from: lineStart, to: start, insert: target, caret: lineStart + target.length };
    }
  }

  return { from: start, to: end, insert: unit, caret: start + unit.length };
}

// Shift+Tab strips one indent level from the front of the current line.
export function outdentEdit(text, start, end) {
  const unit = detectUnit(text);
  const lineStart = lineStartAt(text, start);
  const indent = leadingWhitespace(text.slice(lineStart));
  const removed = indent.startsWith(unit) ? unit.length : indent.length;
  if (removed === 0) return null;

  return {
    from: lineStart,
    to: lineStart + removed,
    insert: '',
    caret: Math.max(start - removed, lineStart),
    selectionEnd: Math.max(end - removed, lineStart),
  };
}
