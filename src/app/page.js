'use client';

import { useState, useRef, useEffect } from 'react';

// Moved outside to prevent re-creation on every render
function EditablePre({ value, onChange, onCommit, style, ...props }) {
  const ref = useRef(null);
  const isEditing = useRef(false);

  // sync incoming value to DOM only when user is not editing
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!isEditing.current && el.textContent !== (value ?? '')) {
      el.textContent = value ?? '';
    }
  }, [value]);

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
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '\t');
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
        onCommit?.(e.currentTarget.textContent);
      }}
      onPaste={handlePaste}
      onCopy={handleCopy}
      onKeyDown={handleKeyDown}
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

  const handleEscape = () => {
    try {
      const parsed = JSON.parse(input);
      const escaped = JSON.stringify(JSON.stringify(parsed));
      const value = escaped.slice(1, -1); // remove outer quotes
      setOutput(value);
      setEditableOutput(value);
    } catch {
      setOutput('❌ Invalid JSON input!');
      setEditableOutput('❌ Invalid JSON input!');
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
    } catch {
      setOutput('❌ Invalid escaped JSON input!');
      setEditableOutput('❌ Invalid escaped JSON input!');
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
