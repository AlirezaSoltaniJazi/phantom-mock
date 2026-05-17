import { useMemo, useState } from 'react';
import type { Group, Rule } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { bucketByBaseDomain, bucketBySubdomain, urlToParts } from '@/shared/url-parts';
import { approxBodySize, type CapturedEntry } from './types';
import { PromoteToRule } from './PromoteToRule';
import type { ImportSummary } from './use-capture';

function entryToParts(e: CapturedEntry) {
  return urlToParts(e.url);
}

interface Props {
  groups: Group[];
  mutate: (mutation: StateMutation) => Promise<void>;
  hostFilter: string;
  setHostFilter: (next: string) => void;
  recording: boolean;
  setRecording: (next: boolean) => void;
  entries: CapturedEntry[];
  clear: () => void;
  importFromNetworkLog: () => Promise<ImportSummary>;
  reloadInspectedPage: () => void;
}

export function Capture({
  groups,
  mutate,
  hostFilter,
  setHostFilter,
  recording,
  setRecording,
  entries,
  clear,
  importFromNetworkLog,
  reloadInspectedPage,
}: Props): JSX.Element {
  const [selected, setSelected] = useState<CapturedEntry | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);

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
          placeholder="Host contains (e.g. freseniusmedicalcare.com) — empty = all hosts"
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
            />
          )}
        </div>

        {selected ? (
          <div className="pm-capture-detail">
            <PromoteToRule
              entry={selected}
              groups={groups}
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
}

function CaptureTree({ entries, selectedId, onSelect }: CaptureTreeProps): JSX.Element {
  // Group newest-first overall, but keep each host bucket in arrival order so
  // related rows stay adjacent.
  const buckets = useMemo(() => bucketByBaseDomain(entries, entryToParts), [entries]);
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
                    >
                      <span className="pm-cap-time">{new Date(e.ts).toLocaleTimeString()}</span>
                      <span className="pm-cap-method">{e.method}</span>
                      <span
                        className={`pm-cap-status ${e.status >= 400 ? 'err' : e.status >= 300 ? 'redir' : ''}`}
                      >
                        {e.status || '—'}
                      </span>
                      <span className="pm-cap-path" title={e.path}>
                        {e.path || '/'}
                      </span>
                      <span className="pm-cap-size">{approxBodySize(e.responseBody)}</span>
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
