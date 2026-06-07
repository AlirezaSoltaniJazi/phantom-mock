import { useMemo, useState, type JSX } from 'react';
import {
  HTTP_METHODS,
  type Group,
  type HeaderOp,
  type HttpMethod,
  type Rule,
  type UrlMatchType,
} from '@/shared/types';
import { DEFAULT_GROUP_ID } from '@/shared/constants';
import { newId } from '@/utils/id';
import { BodyPreview } from '@/devtools/components/BodyPreview';
import { approxBodySize, type CapturedEntry, type CapturedHeader } from './types';

type RuleKind = 'mock' | 'header';

interface Props {
  entry: CapturedEntry;
  groups: Group[];
  onCancel: () => void;
  onCreate: (rule: Rule) => void;
  onCreateGroup: (name: string) => Promise<Group>;
}

interface FieldSelection {
  method: boolean;
  status: boolean;
  responseBody: boolean;
  responseContentType: boolean;
  responseHeaders: Set<string>; // indices as keys
  requestHeaders: Set<string>;
}

function defaultSelection(): FieldSelection {
  return {
    method: true,
    status: true,
    responseBody: true,
    responseContentType: true,
    responseHeaders: new Set(),
    requestHeaders: new Set(),
  };
}

export function PromoteToRule({
  entry,
  groups,
  onCancel,
  onCreate,
  onCreateGroup,
}: Props): JSX.Element {
  const [name, setName] = useState(() => `${entry.method} ${entry.path}`.slice(0, 80));
  const [groupId, setGroupId] = useState(groups[0]?.id ?? DEFAULT_GROUP_ID);
  const [matchType, setMatchType] = useState<UrlMatchType>('contains');
  const [pattern, setPattern] = useState(entry.path);
  const [kind, setKind] = useState<RuleKind>('mock');
  const [selection, setSelection] = useState<FieldSelection>(defaultSelection);

  function toggleResponseHeader(idx: number): void {
    const key = String(idx);
    const next = new Set(selection.responseHeaders);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelection({ ...selection, responseHeaders: next });
  }

  function toggleRequestHeader(idx: number): void {
    const key = String(idx);
    const next = new Set(selection.requestHeaders);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelection({ ...selection, requestHeaders: next });
  }

  const canCreate = useMemo(() => {
    if (!name.trim() || !pattern.trim()) return false;
    if (kind === 'mock') return true;
    return selection.requestHeaders.size > 0 || selection.responseHeaders.size > 0;
  }, [name, pattern, kind, selection]);

  function build(): Rule {
    const method: HttpMethod = selection.method ? (entry.method.toUpperCase() as HttpMethod) : '*';

    if (kind === 'header') {
      const requestHeaders: HeaderOp[] = [...selection.requestHeaders].map((i) => {
        const h = entry.requestHeaders[Number(i)] as CapturedHeader;
        return { name: h.name, value: h.value, op: 'set' };
      });
      const responseHeaders: HeaderOp[] = [...selection.responseHeaders].map((i) => {
        const h = entry.responseHeaders[Number(i)] as CapturedHeader;
        return { name: h.name, value: h.value, op: 'set' };
      });
      return {
        id: newId('rule'),
        name: name.trim(),
        groupId,
        enabled: true,
        match: { method, urlMatchType: matchType, urlPattern: pattern.trim() },
        action: { kind: 'header', requestHeaders, responseHeaders },
      };
    }

    const responseHeaders: HeaderOp[] = [...selection.responseHeaders].map((i) => {
      const h = entry.responseHeaders[Number(i)] as CapturedHeader;
      return { name: h.name, value: h.value, op: 'set' };
    });
    const contentType =
      selection.responseContentType && entry.responseContentType
        ? entry.responseContentType
        : 'application/json';
    return {
      id: newId('rule'),
      name: name.trim(),
      groupId,
      enabled: true,
      match: { method, urlMatchType: matchType, urlPattern: pattern.trim() },
      action: {
        kind: 'mock',
        statusCode: selection.status && entry.status ? entry.status : 200,
        delayMs: 0,
        responseBody: selection.responseBody && entry.responseBody ? entry.responseBody : '',
        responseContentType: contentType,
        responseHeaders,
        logToPanel: true,
      },
    };
  }

  return (
    <div className="pm-form">
      <div className="pm-row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Promote to rule</h3>
        <button type="button" className="pm-btn secondary" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="pm-field">
        <label>Rule name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="pm-row">
        <div className="pm-field" style={{ flex: 1 }}>
          <label>Group</label>
          <div className="pm-row" style={{ gap: 4 }}>
            <select
              style={{ flex: 1 }}
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="pm-btn secondary"
              title="Create a new group and select it"
              onClick={async () => {
                const name = window.prompt('New group name');
                if (!name?.trim()) return;
                try {
                  const grp = await onCreateGroup(name);
                  setGroupId(grp.id);
                } catch (err) {
                  window.alert(`Could not create group: ${(err as Error).message}`);
                }
              }}
            >
              + New
            </button>
          </div>
        </div>
        <div className="pm-field" style={{ flex: 1 }}>
          <label>Rule kind</label>
          <div className="pm-row" style={{ gap: 4 }}>
            <button
              type="button"
              className={`pm-btn secondary ${kind === 'mock' ? 'is-active' : ''}`}
              onClick={() => setKind('mock')}
            >
              Mock response
            </button>
            <button
              type="button"
              className={`pm-btn secondary ${kind === 'header' ? 'is-active' : ''}`}
              onClick={() => setKind('header')}
            >
              Override headers
            </button>
          </div>
        </div>
      </div>

      <fieldset className="pm-fieldset">
        <legend>Match</legend>
        <div className="pm-row">
          <div className="pm-field" style={{ flex: 1 }}>
            <label>
              <input
                type="checkbox"
                checked={selection.method}
                onChange={(e) => setSelection({ ...selection, method: e.target.checked })}
              />{' '}
              Method
            </label>
            <select
              disabled={!selection.method}
              value={selection.method ? entry.method.toUpperCase() : '*'}
              onChange={() => undefined}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="pm-field" style={{ flex: 1 }}>
            <label>URL match type</label>
            <select
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as UrlMatchType)}
            >
              <option value="contains">contains</option>
              <option value="exact">exact</option>
              <option value="regex">regex</option>
            </select>
          </div>
        </div>
        <div className="pm-field">
          <label>Pattern</label>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} />
          <div className="pm-row" style={{ gap: 4, marginTop: 4 }}>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => {
                setMatchType('contains');
                setPattern(entry.path);
              }}
            >
              Use path
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => {
                setMatchType('exact');
                setPattern(entry.url);
              }}
            >
              Use full URL (exact)
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => {
                setMatchType('contains');
                setPattern(entry.host);
              }}
            >
              Use host
            </button>
          </div>
        </div>
      </fieldset>

      {kind === 'mock' ? (
        <fieldset className="pm-fieldset">
          <legend>Mock response from capture</legend>
          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={selection.status}
              onChange={(e) => setSelection({ ...selection, status: e.target.checked })}
            />
            Status code ({entry.status || '—'})
          </label>
          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={selection.responseContentType}
              onChange={(e) =>
                setSelection({ ...selection, responseContentType: e.target.checked })
              }
            />
            Response Content-Type ({entry.responseContentType || '—'})
          </label>
          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={selection.responseBody}
              onChange={(e) => setSelection({ ...selection, responseBody: e.target.checked })}
              disabled={!entry.responseBody}
            />
            Response body ({approxBodySize(entry.responseBody)})
          </label>
          <HeaderPicker
            label="Response headers"
            headers={entry.responseHeaders}
            selected={selection.responseHeaders}
            onToggle={toggleResponseHeader}
          />
        </fieldset>
      ) : (
        <fieldset className="pm-fieldset">
          <legend>Headers to override</legend>
          <HeaderPicker
            label="Request headers"
            headers={entry.requestHeaders}
            selected={selection.requestHeaders}
            onToggle={toggleRequestHeader}
          />
          <HeaderPicker
            label="Response headers"
            headers={entry.responseHeaders}
            selected={selection.responseHeaders}
            onToggle={toggleResponseHeader}
          />
        </fieldset>
      )}

      <fieldset className="pm-fieldset">
        <legend>Captured request (read-only)</legend>
        <details>
          <summary>Request body ({approxBodySize(entry.requestBody)})</summary>
          <BodyPreview body={entry.requestBody} />
        </details>
        <details>
          <summary>Response body ({approxBodySize(entry.responseBody)})</summary>
          {entry.responseEncoding === 'base64' ? (
            <pre className="pm-pre">(binary, base64 encoded — not previewed)</pre>
          ) : (
            <BodyPreview body={entry.responseBody} />
          )}
        </details>
      </fieldset>

      <div className="pm-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="pm-btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="pm-btn"
          disabled={!canCreate}
          onClick={() => onCreate(build())}
        >
          Create rule
        </button>
      </div>
    </div>
  );
}

interface HeaderPickerProps {
  label: string;
  headers: CapturedHeader[];
  selected: Set<string>;
  onToggle: (idx: number) => void;
}

function HeaderPicker({ label, headers, selected, onToggle }: HeaderPickerProps): JSX.Element {
  return (
    <div className="pm-field">
      <label>
        {label} ({selected.size}/{headers.length} selected)
      </label>
      <div className="pm-header-list">
        {headers.length === 0 ? (
          <em style={{ color: 'var(--fg-muted)' }}>None.</em>
        ) : (
          headers.map((h, i) => (
            <label className="pm-checkbox pm-header-row-pick" key={i}>
              <input
                type="checkbox"
                checked={selected.has(String(i))}
                onChange={() => onToggle(i)}
              />
              <span className="pm-method" style={{ minWidth: 'unset' }}>
                {h.name}
              </span>
              <span className="pm-url" title={h.value}>
                {h.value}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
