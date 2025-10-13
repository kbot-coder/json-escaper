'use client';

import { useState, useCallback } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [editableOutput, setEditableOutput] = useState('');

  const handleEscape = () => {
    try {
      const parsed = JSON.parse(input);
      const escaped = JSON.stringify(JSON.stringify(parsed));
      setOutput(escaped.slice(1, -1)); // remove outer quotes
    } catch {
      setOutput('❌ Invalid JSON input!');
    }
  };

  const handleUnescape = () => {
    try {
      // Try to interpret escaped string as normal JSON text
      const unescaped = JSON.parse(`"${input}"`);
      const parsed = JSON.parse(unescaped);
      const pretty = JSON.stringify(parsed, null, 2);
      setOutput(pretty);
    } catch {
      setOutput('❌ Invalid escaped JSON input!');
    }
  };

  const handleContentEdit = useCallback((e) => {
    setEditableOutput(e.currentTarget.textContent);
  }, []);

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
        placeholder='Enter JSON or escaped string here...'
        style={{
          margin: '1rem 0',
          fontFamily: 'monospace',
          padding: '0.5rem',
          borderRadius: '6px',
          border: '1px solid #ccc',
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
        <pre
        contentEditable
        onInput={handleContentEdit}
        suppressContentEditableWarning={true}
        style={{
          background: '#212121',
          padding: '1rem',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          textAlign: 'left',
        }}
      >
        {editableOutput || output}
      </pre>
      ) : ""}
      
    </main>
  );
}
