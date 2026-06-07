import { useMemo, type JSX } from 'react';
import { JsonTreeView } from './JsonTreeView';

interface Props {
  body: string | null;
  emptyText?: string;
}

// Renders a captured request/response body. Valid JSON objects/arrays render as
// a collapsible, colorized tree (read-only — no onChange passed); anything else
// (form-encoded, plain text, a bare primitive) falls back to raw monospace text.
export function BodyPreview({ body, emptyText = '(none)' }: Props): JSX.Element {
  const json = useMemo<{ value: unknown } | null>(() => {
    if (body === null) return null;
    const trimmed = body.trim();
    // Cheap pre-check: only objects/arrays are worth tree-rendering, so skip the
    // JSON.parse for anything that can't start one.
    if (trimmed[0] !== '{' && trimmed[0] !== '[') return null;
    try {
      return { value: JSON.parse(body) as unknown };
    } catch {
      return null;
    }
  }, [body]);

  if (body === null || body === '') {
    return <pre className="pm-pre">{emptyText}</pre>;
  }
  if (json && json.value !== null && typeof json.value === 'object') {
    return <JsonTreeView value={json.value} />;
  }
  return <pre className="pm-pre">{body}</pre>;
}
