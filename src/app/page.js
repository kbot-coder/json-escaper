'use client';

import { useState, useRef, useEffect } from 'react';

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
      const pretty = JSON.stringify(parsed, null, 2);
      setOutput(pretty);
      setEditableOutput(pretty);
    } catch {
      setOutput('❌ Invalid escaped JSON input!');
      setEditableOutput('❌ Invalid escaped JSON input!');
    }
  };

  // small ref-driven contentEditable wrapper to avoid React replacing children while typing
  function EditablePre({ value, onChange, onCommit, ...props }) {
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

    return (
      <pre
        {...props}
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={(e) => onChange?.(e.currentTarget.textContent)}
        onFocus={() => (isEditing.current = true)}
        onBlur={(e) => {
          isEditing.current = false;
          onCommit?.(e.currentTarget.textContent);
        }}
      />
    );
  }


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
          }}
        />
      ) : (
        ''
      )}
    </main>
  );
}
