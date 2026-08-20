'use client';

import { useState, useRef, useEffect } from 'react';
import { enterEdit, tabEdit, outdentEdit } from './indent.js';
import { getSelectionOffsets, selectRange } from './caret.js';
import { paint, paintEscaped } from './highlight.js';
import { showBracketMatch } from './brackets.js';

// how long typing has to pause before the syntax colours are refreshed
const REPAINT_DELAY = 250;

// light up the bracket pair around the caret, if it is sitting next to one
function syncBrackets(el) {
  const focused = el.ownerDocument.activeElement === el;
  const selection = focused ? getSelectionOffsets(el) : null;
  const caret = selection && selection.start === selection.end ? selection.start : null;
  showBracketMatch(el, caret);
}

// re-render the syntax highlighting without moving the user's caret
function repaint(el, text, useEscaped = false) {
  const selection = el.ownerDocument.activeElement === el ? getSelectionOffsets(el) : null;
  if (useEscaped) {
    paintEscaped(el, text);
  } else {
    paint(el, text);
  }
  if (selection) selectRange(el, selection.start, selection.end);
  syncBrackets(el);
}

// apply an edit descriptor from ./indent
// returns { newText, caret, caretEnd } for the caller to handle
function computeEdit(text, edit) {
  if (!edit) return null;
  const newText = text.slice(0, edit.from) + (edit.insert ?? '') + text.slice(edit.to);
  const caretEnd = edit.selectionEnd ?? edit.caret;
  return { newText, caret: edit.caret, caretEnd };
}

// Moved outside to prevent re-creation on every render
function EditablePre({ value, onChange, onCommit, useEscaped = false, style, ...props }) {
  const ref = useRef(null);
  const isEditing = useRef(false);
  const isComposing = useRef(false);
  const pendingCaret = useRef(null); // { start, end } to restore after repaint

  // sync incoming value to DOM only when user is not editing; while editing,
  // wait for a pause in typing so re-highlighting never fights the keyboard
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If we have a pending caret from a programmatic edit (Enter/Tab),
    // update the DOM immediately and position the caret
    if (pendingCaret.current) {
      const { start, end } = pendingCaret.current;
      pendingCaret.current = null;
      if (useEscaped) {
        paintEscaped(el, value ?? '');
      } else {
        paint(el, value ?? '');
      }
      selectRange(el, start, end);
      syncBrackets(el);
      return;
    }

    if (!isEditing.current) {
      if (el.textContent !== (value ?? '')) repaint(el, value ?? '', useEscaped);
      return;
    }

    const timer = setTimeout(() => {
      // rebuilding the DOM mid-composition would cancel the IME
      if (!isComposing.current) repaint(el, el.textContent ?? '', useEscaped);
    }, REPAINT_DELAY);
    return () => clearTimeout(timer);
  }, [value, useEscaped]);

  // follow the caret (arrow keys, clicks, edits) to keep the bracket pair lit
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const doc = el.ownerDocument;
    const handler = () => syncBrackets(el);
    doc.addEventListener('selectionchange', handler);
    return () => doc.removeEventListener('selectionchange', handler);
  }, []);

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleCopy = (e) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      e.clipboardData.setData('text/plain', selection.toString());
      e.preventDefault();
    }
  };

  const handleKeyDown = (e) => {
    const el = ref.current;
    if (!el || (e.key !== 'Tab' && e.key !== 'Enter')) return;
    // Enter confirms an IME candidate; leave it to the input method
    if (e.nativeEvent.isComposing) return;

    e.preventDefault();

    const text = el.textContent ?? '';
    const pos = getSelectionOffsets(el);
    if (!pos) return;

    let edit;
    if (e.key === 'Enter') edit = enterEdit(text, pos.start, pos.end);
    else if (e.shiftKey) edit = outdentEdit(text, pos.start, pos.end);
    else edit = tabEdit(text, pos.start, pos.end);

    const result = computeEdit(text, edit);
    if (result) {
      // Store where caret should go after the DOM updates
      pendingCaret.current = { start: result.caret, end: result.caretEnd };
      onChange?.(result.newText);
    }
  };

  return (
    <pre
      {...props}
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      tabIndex={0}
      onInput={(e) => onChange?.(e.currentTarget.textContent)}
      onFocus={() => (isEditing.current = true)}
      onBlur={(e) => {
        isEditing.current = false;
        const el = e.currentTarget;
        const text = el.textContent;
        if (useEscaped) {
          paintEscaped(el, text);
        } else {
          paint(el, text);
        }
        showBracketMatch(el, null);
        onCommit?.(text);
      }}
      onPaste={handlePaste}
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
      onCompositionStart={() => (isComposing.current = true)}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        repaint(e.currentTarget, e.currentTarget.textContent ?? '', useEscaped);
      }}
      style={{
        ...style,
        cursor: 'text',
        outline: 'none',
        tabSize: 2,
        MozTabSize: 2,
      }}
    />
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [editableOutput, setEditableOutput] = useState('');
  const [isEscaped, setIsEscaped] = useState(false);

  const handleEscape = () => {
    try {
      const parsed = JSON.parse(input);
      const escaped = JSON.stringify(JSON.stringify(parsed));
      const value = escaped.slice(1, -1); // remove outer quotes
      setOutput(value);
      setEditableOutput(value);
      setIsEscaped(true);
    } catch {
      setOutput('❌ Invalid JSON input!');
      setEditableOutput('❌ Invalid JSON input!');
      setIsEscaped(false);
    }
  };

  const handleUnescape = () => {
    try {
      // Try to interpret escaped string as normal JSON text
      const unescaped = JSON.parse(`"${input}"`);
      const parsed = JSON.parse(unescaped);
      const pretty = JSON.stringify(parsed, null, '\t');
      setOutput(pretty);
      setEditableOutput(pretty);
      setIsEscaped(false);
    } catch {
      setOutput('❌ Invalid escaped JSON input!');
      setEditableOutput('❌ Invalid escaped JSON input!');
      setIsEscaped(false);
    }
  };


  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2rem',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>JSON Escaper / Unescaper</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        placeholder="Enter JSON or escaped string here..."
        style={{
          margin: '1rem 0',
          fontFamily: 'monospace',
          padding: '0.5rem',
          borderRadius: '6px',
          border: '1px solid #ccc',
          width: '70%',
          maxWidth: '1200px',
        }}
      />

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '50px' }}>
        <button
          onClick={handleEscape}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Escape JSON
        </button>

        <button
          onClick={handleUnescape}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Unescape JSON
        </button>
      </div>

      {output ? (
        <EditablePre
          value={editableOutput || output}
          onChange={setEditableOutput}
          useEscaped={isEscaped}
          onCommit={(text) => {
            setOutput(text);
            setEditableOutput(text);
          }}
          style={{
            background: '#212121',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            textAlign: 'left',
            width: '70%',
            maxWidth: '1200px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            margin: 0,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        ''
      )}
    </main>
  );
}
