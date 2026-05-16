import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface JsonTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

type Path = ReadonlyArray<string | number>;

interface Props {
  value: unknown;
  /**
   * When provided, primitive leaves become editable. Called with the entire
   * new root value whenever a leaf is committed.
   */
  onChange?: (next: unknown) => void;
}

export const JsonTreeView = forwardRef<JsonTreeHandle, Props>(function JsonTreeView(
  { value, onChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => ({
    expandAll: () => {
      containerRef.current?.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    },
    collapseAll: () => {
      containerRef.current?.querySelectorAll('details').forEach((d) => d.removeAttribute('open'));
    },
  }));

  const handleLeafEdit =
    onChange &&
    ((path: Path, next: unknown) => {
      onChange(updateAtPath(value, path, next));
    });

  return (
    <div className="pm-json-tree" ref={containerRef}>
      <Node value={value} keyLabel={null} path={[]} onEdit={handleLeafEdit} />
    </div>
  );
});

interface NodeProps {
  value: unknown;
  keyLabel: string | null;
  path: Path;
  onEdit: ((path: Path, next: unknown) => void) | undefined;
}

function Node({ value, keyLabel, path, onEdit }: NodeProps): JSX.Element {
  if (Array.isArray(value)) {
    return (
      <details open className="pm-json-node">
        <summary>
          {keyLabel !== null ? <span className="pm-json-key">{keyLabel}: </span> : null}
          <span className="pm-json-bracket">[</span>
          <span className="pm-json-preview">
            {value.length} item{value.length === 1 ? '' : 's'}
          </span>
          <span className="pm-json-bracket">]</span>
        </summary>
        <div className="pm-json-children">
          {value.map((item, i) => (
            <Node key={i} value={item} keyLabel={String(i)} path={[...path, i]} onEdit={onEdit} />
          ))}
        </div>
      </details>
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      <details open className="pm-json-node">
        <summary>
          {keyLabel !== null ? <span className="pm-json-key">{keyLabel}: </span> : null}
          <span className="pm-json-bracket">{'{'}</span>
          <span className="pm-json-preview">
            {entries.length} key{entries.length === 1 ? '' : 's'}
          </span>
          <span className="pm-json-bracket">{'}'}</span>
        </summary>
        <div className="pm-json-children">
          {entries.map(([k, v]) => (
            <Node key={k} value={v} keyLabel={k} path={[...path, k]} onEdit={onEdit} />
          ))}
        </div>
      </details>
    );
  }
  return (
    <div className="pm-json-leaf">
      {keyLabel !== null ? <span className="pm-json-key">{keyLabel}: </span> : null}
      <EditablePrimitive
        value={value}
        editable={Boolean(onEdit)}
        onCommit={(next) => onEdit?.(path, next)}
      />
    </div>
  );
}

interface EditablePrimitiveProps {
  value: unknown;
  editable: boolean;
  onCommit: (next: unknown) => void;
}

function EditablePrimitive({ value, editable, onCommit }: EditablePrimitiveProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => primitiveToText(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function start(): void {
    if (!editable) return;
    setDraft(primitiveToText(value));
    setEditing(true);
  }

  function commit(): void {
    setEditing(false);
    const next = parseWithType(draft, value);
    if (!sameValue(next, value)) onCommit(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="pm-json-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    );
  }

  if (typeof value === 'boolean') {
    return (
      <button
        type="button"
        className="pm-json-boolean pm-json-clickable"
        onClick={editable ? () => onCommit(!value) : undefined}
        disabled={!editable}
        title={editable ? 'Click to toggle' : undefined}
      >
        {String(value)}
      </button>
    );
  }

  const className =
    value === null
      ? 'pm-json-null'
      : typeof value === 'string'
        ? 'pm-json-string'
        : typeof value === 'number'
          ? 'pm-json-number'
          : '';
  const display =
    value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value);

  return (
    <span
      className={`${className} ${editable ? 'pm-json-clickable' : ''}`}
      onClick={editable ? start : undefined}
      title={editable ? 'Click to edit' : undefined}
    >
      {display}
    </span>
  );
}

function primitiveToText(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return String(value);
}

function parseWithType(text: string, original: unknown): unknown {
  if (typeof original === 'number') {
    if (text.trim() === '') return text;
    const num = Number(text);
    return Number.isFinite(num) ? num : text;
  }
  if (typeof original === 'boolean') {
    const lower = text.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return text;
  }
  if (original === null) {
    if (text.trim().toLowerCase() === 'null') return null;
    if (text.trim() === '') return null;
    const num = Number(text);
    if (Number.isFinite(num) && text.trim() !== '') return num;
    return text;
  }
  return text;
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function updateAtPath(root: unknown, path: Path, next: unknown): unknown {
  if (path.length === 0) return next;
  const [head, ...rest] = path;
  if (Array.isArray(root) && typeof head === 'number') {
    const copy = root.slice();
    copy[head] = updateAtPath(copy[head], rest, next);
    return copy;
  }
  if (root && typeof root === 'object' && typeof head === 'string') {
    const copy = { ...(root as Record<string, unknown>) };
    copy[head] = updateAtPath(copy[head], rest, next);
    return copy;
  }
  // Path diverged from shape — return root unchanged.
  return root;
}
