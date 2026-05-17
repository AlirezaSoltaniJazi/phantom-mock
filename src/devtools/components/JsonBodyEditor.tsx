import { useMemo, useRef, useState } from 'react';
import { JsonTreeView, type JsonTreeHandle } from './JsonTreeView';

interface Props {
  value: string;
  onChange: (next: string) => void;
  contentType: string;
}

type Mode = 'edit' | 'tree';

export function JsonBodyEditor({ value, onChange, contentType }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('edit');
  const treeRef = useRef<JsonTreeHandle | null>(null);

  const looksJson = contentType.toLowerCase().includes('json');
  const parsed = useMemo(() => {
    if (!looksJson) return { ok: false as const, error: 'Content-Type is not JSON' };
    try {
      return { ok: true as const, value: JSON.parse(value) as unknown };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  }, [looksJson, value]);

  function prettyPrint(): void {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 4));
    } catch {
      /* leave body alone if invalid */
    }
  }

  function minify(): void {
    try {
      onChange(JSON.stringify(JSON.parse(value)));
    } catch {
      /* leave body alone if invalid */
    }
  }

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard may be denied; ignore */
    }
  }

  return (
    <div className="pm-body-editor">
      <div className="pm-toolbar pm-toolbar-tight">
        <div className="pm-row" style={{ gap: 4 }}>
          <button
            type="button"
            className={`pm-btn secondary ${mode === 'edit' ? 'is-active' : ''}`}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={`pm-btn secondary ${mode === 'tree' ? 'is-active' : ''}`}
            disabled={!parsed.ok}
            onClick={() => setMode('tree')}
            title={parsed.ok ? 'Show tree view' : `Cannot parse JSON: ${parsed.error}`}
          >
            Tree
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {mode === 'tree' ? (
          <>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => treeRef.current?.expandAll()}
            >
              Expand all
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => treeRef.current?.collapseAll()}
            >
              Collapse all
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={prettyPrint}
              disabled={!parsed.ok}
            >
              Pretty
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={minify}
              disabled={!parsed.ok}
            >
              Minify
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => void copyToClipboard()}
            >
              Copy
            </button>
          </>
        )}
      </div>
      {mode === 'edit' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : parsed.ok ? (
        <JsonTreeView
          ref={treeRef}
          value={parsed.value}
          onChange={(next) => {
            // Preserve the user's current formatting: pretty-print if the body
            // already had line breaks, minify otherwise.
            const pretty = value.includes('\n');
            onChange(pretty ? JSON.stringify(next, null, 4) : JSON.stringify(next));
          }}
        />
      ) : (
        <div className="pm-error">Cannot show tree: {parsed.error}</div>
      )}
    </div>
  );
}
