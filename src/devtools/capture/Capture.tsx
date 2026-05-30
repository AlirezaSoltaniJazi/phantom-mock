import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  CAPTURE_COLUMN_LABELS,
  CAPTURE_COLUMN_ORDER,
  type CaptureColumn,
  type Group,
  type Rule,
  type UIPreferences,
} from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { bucketByBaseDomain, bucketBySubdomain, urlToParts } from '@/shared/url-parts';
import { approxBodySize, formatDuration, type CapturedEntry } from './types';
import { PromoteToRule } from './PromoteToRule';
import type { ImportSummary } from './use-capture';

function entryToParts(e: CapturedEntry) {
  return urlToParts(e.url);
}

const COLUMN_WIDTHS: Record<CaptureColumn, string> = {
  time: '72px',
  method: '56px',
  status: '48px',
  path: 'minmax(0, 1fr)',
  size: '60px',
  duration: '64px',
};

interface Props {
  groups: Group[];
  mutate: (mutation: StateMutation) => Promise<void>;
  onCreateGroup: (name: string) => Promise<Group>;
  hostFilter: string;
  setHostFilter: (next: string) => void;
  recording: boolean;
  setRecording: (next: boolean) => void;
  entries: CapturedEntry[];
  clear: () => void;
  importFromNetworkLog: () => Promise<ImportSummary>;
  reloadInspectedPage: () => void;
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
}

export function Capture({
  groups,
  mutate,
  onCreateGroup,
  hostFilter,
  setHostFilter,
  recording,
  setRecording,
  entries,
  clear,
  importFromNetworkLog,
  reloadInspectedPage,
  prefs,
  setPrefs,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<CapturedEntry | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);

  function toggleColumn(col: CaptureColumn): void {
    const next = { ...prefs.captureColumns, [col]: !prefs.captureColumns[col] };
    // Don't allow turning every column off — keep path on as a fallback.
    if (!Object.values(next).some(Boolean)) next.path = true;
    void setPrefs({ ...prefs, captureColumns: next });
  }

  const visibleColumns = useMemo<CaptureColumn[]>(
    () => CAPTURE_COLUMN_ORDER.filter((c) => prefs.captureColumns[c]),
    [prefs.captureColumns]
  );

  async function onCreateRule(rule: Rule): Promise<void> {
    await mutate({ kind: 'upsertRule', rule });
    setSelected(null);
  }

  async function doImport(): Promise<void> {
    setImportInfo('Importing…');
    try {
      const { total, matched } = await importFromNetworkLog();
      if (total === 0) {
        setImportInfo(
          'The Network panel reported 0 requests in its HAR log. Open the Network tab in DevTools and reload the page once with "Preserve log" on, then try again.'
        );
      } else if (matched === 0) {
        setImportInfo(
          `Found ${total} request${total === 1 ? '' : 's'} in the Network log but none matched the host filter "${hostFilter || '(empty)'}". Adjust the filter and retry.`
        );
      } else {
        setImportInfo(
          `Imported ${matched} of ${total} request${total === 1 ? '' : 's'} from the Network panel log.`
        );
      }
    } catch (err) {
      setImportInfo(`Import failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="pm-capture">
      <div className="pm-capture-toolbar">
        <input
          className="pm-capture-filter"
          type="text"
          placeholder="Host contains (e.g. example.com) — empty = all hosts"
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
        />
        <button
          type="button"
          className={`pm-btn ${recording ? 'danger' : ''}`}
          onClick={() => setRecording(!recording)}
        >
          {recording ? '■ Stop' : '● Record'}
        </button>
        <button type="button" className="pm-btn secondary" onClick={() => void doImport()}>
          Import from Network log
        </button>
        <button type="button" className="pm-btn secondary" onClick={reloadInspectedPage}>
          Reload page
        </button>
        <button type="button" className="pm-btn secondary" onClick={clear}>
          Clear
        </button>
        <ColumnsMenu columns={prefs.captureColumns} onToggle={toggleColumn} />
        <span style={{ color: 'var(--fg-muted)', marginLeft: 4 }}>{entries.length} captured</span>
      </div>

      {importInfo ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: 'calc(var(--pm-font-size) - 1px)' }}>
          {importInfo}
        </div>
      ) : null}

      <div className="pm-capture-body">
        <div className="pm-capture-list">
          {entries.length === 0 ? (
            <div className="pm-empty">
              {recording
                ? 'Recording. Phantom Mock starts capturing the moment DevTools opens — requests that fire while DevTools was closed are invisible to extensions, so click "Reload page" if your traffic already happened. "Import from Network log" backfills whatever Chrome has exposed to us since DevTools opened.'
                : 'Recording paused. Click ● Record to start.'}
            </div>
          ) : (
            <CaptureTree
              entries={entries}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              columns={visibleColumns}
            />
          )}
        </div>

        {selected ? (
          <div className="pm-capture-detail">
            <PromoteToRule
              key={selected.id}
              entry={selected}
              groups={groups}
              onCreateGroup={onCreateGroup}
              onCancel={() => setSelected(null)}
              onCreate={(rule) => void onCreateRule(rule)}
            />
          </div>
        ) : (
          <div className="pm-capture-detail pm-empty">
            Select a captured request on the left to promote it into a rule.
          </div>
        )}
      </div>
    </div>
  );
}

interface CaptureTreeProps {
  entries: CapturedEntry[];
  selectedId: string | null;
  onSelect: (entry: CapturedEntry) => void;
  columns: CaptureColumn[];
}

function CaptureTree({ entries, selectedId, onSelect, columns }: CaptureTreeProps): JSX.Element {
  // Group newest-first overall, but keep each host bucket in arrival order so
  // related rows stay adjacent.
  const buckets = useMemo(() => bucketByBaseDomain(entries, entryToParts), [entries]);
  const gridTemplate = useMemo(() => columns.map((c) => COLUMN_WIDTHS[c]).join(' '), [columns]);
  const rowStyle = { gridTemplateColumns: gridTemplate };
  return (
    <div className="pm-capture-tree">
      {buckets.map((bucket, bi) => {
        const subs = bucketBySubdomain(bucket.items, entryToParts);
        return (
          <details open className="pm-cap-host" key={`b-${bi}`}>
            <summary>
              <span className="pm-cap-host-name">{bucket.baseDomain ?? '(no host)'}</span>
              <span className="pm-cap-count">{bucket.items.length}</span>
            </summary>
            {subs.map((sub, si) => (
              <details open className="pm-cap-sub" key={`b-${bi}-s-${si}`}>
                <summary>
                  <span className="pm-cap-sub-name">{sub.subdomain ?? '(root)'}</span>
                  <span className="pm-cap-count">{sub.items.length}</span>
                </summary>
                <div className="pm-cap-rows">
                  {sub.items.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      className={`pm-cap-row ${selectedId === e.id ? 'is-selected' : ''}`}
                      onClick={() => onSelect(e)}
                      style={rowStyle}
                    >
                      {columns.map((col) => (
                        <CaptureCell key={col} col={col} entry={e} />
                      ))}
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </details>
        );
      })}
    </div>
  );
}

function CaptureCell({ col, entry }: { col: CaptureColumn; entry: CapturedEntry }): JSX.Element {
  switch (col) {
    case 'time':
      return <span className="pm-cap-time">{new Date(entry.ts).toLocaleTimeString()}</span>;
    case 'method':
      return <span className="pm-cap-method">{entry.method}</span>;
    case 'status':
      return (
        <span
          className={`pm-cap-status ${entry.status >= 400 ? 'err' : entry.status >= 300 ? 'redir' : ''}`}
        >
          {entry.status || '—'}
        </span>
      );
    case 'path':
      return (
        <span className="pm-cap-path" title={entry.path}>
          {entry.path || '/'}
        </span>
      );
    case 'size':
      return <span className="pm-cap-size">{approxBodySize(entry.responseBody)}</span>;
    case 'duration':
      return <span className="pm-cap-size">{formatDuration(entry.durationMs)}</span>;
  }
}

interface ColumnsMenuProps {
  columns: Record<CaptureColumn, boolean>;
  onToggle: (col: CaptureColumn) => void;
}

function ColumnsMenu({ columns, onToggle }: ColumnsMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="pm-columns-menu" ref={wrapRef}>
      <button
        type="button"
        className="pm-btn secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Columns ▾
      </button>
      {open ? (
        <div className="pm-columns-popover">
          {CAPTURE_COLUMN_ORDER.map((col) => (
            <label key={col} className="pm-checkbox">
              <input type="checkbox" checked={columns[col]} onChange={() => onToggle(col)} />
              {CAPTURE_COLUMN_LABELS[col]}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
