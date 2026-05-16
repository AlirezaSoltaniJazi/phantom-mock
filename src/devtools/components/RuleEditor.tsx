import { useMemo, useState } from 'react';
import {
  HTTP_METHODS,
  type Group,
  type HeaderAction,
  type HeaderOp,
  type HttpMethod,
  type MockAction,
  type Rule,
  type UrlMatchType,
} from '@/shared/types';
import { MAX_DELAY_MS, MAX_STATUS_CODE, MIN_STATUS_CODE } from '@/shared/constants';
import { compileRegex, specMatches } from '@/shared/matcher';
import { newId } from '@/utils/id';
import { JsonBodyEditor } from './JsonBodyEditor';

interface Props {
  initial: Rule | null;
  groups: Group[];
  onSave: (rule: Rule) => void;
  onCancel: () => void;
  onDelete?: (() => void) | undefined;
}

const URL_MATCH_TYPES: UrlMatchType[] = ['exact', 'contains', 'regex'];

function emptyMock(): MockAction {
  return {
    kind: 'mock',
    statusCode: 200,
    delayMs: 0,
    responseBody: '{}',
    responseContentType: 'application/json',
    responseHeaders: [],
    logToPanel: true,
  };
}

function emptyHeader(): HeaderAction {
  return { kind: 'header', requestHeaders: [], responseHeaders: [] };
}

function defaultRule(groupId: string): Rule {
  return {
    id: newId('rule'),
    name: 'New rule',
    groupId,
    enabled: true,
    match: { method: 'GET', urlMatchType: 'contains', urlPattern: '' },
    action: emptyMock(),
  };
}

export function RuleEditor({ initial, groups, onSave, onCancel, onDelete }: Props): JSX.Element {
  const seed = initial ?? defaultRule(groups[0]?.id ?? 'default');
  const [draft, setDraft] = useState<Rule>(seed);
  const [testUrl, setTestUrl] = useState('');

  const regexError = useMemo(() => {
    if (draft.match.urlMatchType !== 'regex') return null;
    return compileRegex(draft.match.urlPattern) ? null : 'Invalid regular expression';
  }, [draft.match.urlMatchType, draft.match.urlPattern]);

  const jsonWarn = useMemo(() => {
    if (draft.action.kind !== 'mock') return null;
    if (!draft.action.responseContentType.includes('json')) return null;
    try {
      JSON.parse(draft.action.responseBody);
      return null;
    } catch (err) {
      return `Body is not valid JSON: ${(err as Error).message}`;
    }
  }, [draft.action]);

  const statusError = useMemo(() => {
    if (draft.action.kind !== 'mock') return null;
    if (draft.action.statusCode < MIN_STATUS_CODE || draft.action.statusCode > MAX_STATUS_CODE) {
      return `Status code must be ${MIN_STATUS_CODE}..${MAX_STATUS_CODE}`;
    }
    return null;
  }, [draft.action]);

  const delayError = useMemo(() => {
    if (draft.action.kind !== 'mock') return null;
    if (draft.action.delayMs < 0 || draft.action.delayMs > MAX_DELAY_MS) {
      return `Delay must be 0..${MAX_DELAY_MS}ms`;
    }
    return null;
  }, [draft.action]);

  const testResult = useMemo(() => {
    if (!testUrl) return null;
    return specMatches(
      draft.match,
      testUrl,
      draft.match.method === '*' ? 'GET' : draft.match.method
    )
      ? 'matches'
      : 'no match';
  }, [draft.match, testUrl]);

  const canSave = !regexError && !statusError && !delayError && draft.name.trim().length > 0;

  function updateMock(patch: Partial<MockAction>): void {
    if (draft.action.kind !== 'mock') return;
    setDraft({ ...draft, action: { ...draft.action, ...patch } });
  }

  function updateHeader(patch: Partial<HeaderAction>): void {
    if (draft.action.kind !== 'header') return;
    setDraft({ ...draft, action: { ...draft.action, ...patch } });
  }

  function switchType(kind: 'mock' | 'header'): void {
    if (draft.action.kind === kind) return;
    setDraft({ ...draft, action: kind === 'mock' ? emptyMock() : emptyHeader() });
  }

  return (
    <div className="pm-form">
      <div className="pm-field">
        <label>Name</label>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </div>
      <div className="pm-row">
        <div className="pm-field" style={{ flex: 1 }}>
          <label>Group</label>
          <select
            value={draft.groupId}
            onChange={(e) => setDraft({ ...draft, groupId: e.target.value })}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pm-field" style={{ flex: 1 }}>
          <label>Type</label>
          <select
            value={draft.action.kind}
            onChange={(e) => switchType(e.target.value as 'mock' | 'header')}
          >
            <option value="mock">Mock response</option>
            <option value="header">Override headers</option>
          </select>
        </div>
      </div>

      <fieldset style={{ border: '1px solid var(--border)', padding: 12 }}>
        <legend>Match</legend>
        <div className="pm-row">
          <div className="pm-field" style={{ flex: 1 }}>
            <label>Method</label>
            <select
              value={draft.match.method}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  match: { ...draft.match, method: e.target.value as HttpMethod },
                })
              }
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="pm-field" style={{ flex: 1 }}>
            <label>URL match</label>
            <select
              value={draft.match.urlMatchType}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  match: { ...draft.match, urlMatchType: e.target.value as UrlMatchType },
                })
              }
            >
              {URL_MATCH_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pm-field">
          <label>Pattern</label>
          <input
            className={regexError ? 'is-invalid' : ''}
            value={draft.match.urlPattern}
            onChange={(e) =>
              setDraft({ ...draft, match: { ...draft.match, urlPattern: e.target.value } })
            }
          />
          {regexError ? <div className="pm-error">{regexError}</div> : null}
        </div>
        <div className="pm-field">
          <label>Test against URL</label>
          <input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
          {testResult ? (
            <div className={testResult === 'matches' ? 'pm-warn' : 'pm-error'}>{testResult}</div>
          ) : null}
        </div>
      </fieldset>

      {draft.action.kind === 'mock' ? (
        <fieldset style={{ border: '1px solid var(--border)', padding: 12 }}>
          <legend>Mock response</legend>
          <div className="pm-row">
            <div className="pm-field" style={{ flex: 1 }}>
              <label>Status code</label>
              <input
                type="number"
                value={draft.action.statusCode}
                onChange={(e) => updateMock({ statusCode: Number(e.target.value) })}
              />
              {statusError ? <div className="pm-error">{statusError}</div> : null}
            </div>
            <div className="pm-field" style={{ flex: 1 }}>
              <label>Delay (ms)</label>
              <input
                type="number"
                value={draft.action.delayMs}
                onChange={(e) => updateMock({ delayMs: Number(e.target.value) })}
              />
              {delayError ? <div className="pm-error">{delayError}</div> : null}
            </div>
            <div className="pm-field" style={{ flex: 1 }}>
              <label>Content-Type</label>
              <input
                value={draft.action.responseContentType}
                onChange={(e) => updateMock({ responseContentType: e.target.value })}
              />
            </div>
          </div>
          <div className="pm-field">
            <label>Response body</label>
            <JsonBodyEditor
              value={draft.action.responseBody}
              contentType={draft.action.responseContentType}
              onChange={(next) => updateMock({ responseBody: next })}
            />
            {jsonWarn ? <div className="pm-warn">{jsonWarn}</div> : null}
          </div>
          <HeaderOpsEditor
            label="Response headers"
            ops={draft.action.responseHeaders}
            onChange={(responseHeaders) => updateMock({ responseHeaders })}
          />
          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={draft.action.logToPanel}
              onChange={(e) => updateMock({ logToPanel: e.target.checked })}
            />
            Log overridden requests to the Hit Log panel
          </label>
        </fieldset>
      ) : (
        <fieldset style={{ border: '1px solid var(--border)', padding: 12 }}>
          <legend>Header overrides</legend>
          <HeaderOpsEditor
            label="Request headers"
            ops={draft.action.requestHeaders}
            onChange={(requestHeaders) => updateHeader({ requestHeaders })}
          />
          <HeaderOpsEditor
            label="Response headers"
            ops={draft.action.responseHeaders}
            onChange={(responseHeaders) => updateHeader({ responseHeaders })}
          />
        </fieldset>
      )}

      <div className="pm-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {onDelete ? (
          <button className="pm-btn danger" type="button" onClick={onDelete}>
            Delete
          </button>
        ) : null}
        <button className="pm-btn secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="pm-btn" type="button" disabled={!canSave} onClick={() => onSave(draft)}>
          Save rule
        </button>
      </div>
    </div>
  );
}

interface HeaderOpsEditorProps {
  label: string;
  ops: HeaderOp[];
  onChange: (next: HeaderOp[]) => void;
}

function HeaderOpsEditor({ label, ops, onChange }: HeaderOpsEditorProps): JSX.Element {
  function add(): void {
    onChange([...ops, { name: '', value: '', op: 'set' }]);
  }
  function update(index: number, patch: Partial<HeaderOp>): void {
    const next = ops.slice();
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...patch } as HeaderOp;
    onChange(next);
  }
  function remove(index: number): void {
    onChange(ops.filter((_, i) => i !== index));
  }
  return (
    <div className="pm-field">
      <label>{label}</label>
      <div className="pm-headers">
        {ops.map((op, i) => (
          <div className="pm-header-row" key={i}>
            <select
              value={op.op}
              onChange={(e) => update(i, { op: e.target.value as HeaderOp['op'] })}
            >
              <option value="set">set</option>
              <option value="append">append</option>
              <option value="remove">remove</option>
            </select>
            <input
              placeholder="Header name"
              value={op.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              placeholder="Value"
              value={op.value ?? ''}
              disabled={op.op === 'remove'}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <button className="pm-btn secondary" type="button" onClick={() => remove(i)}>
              ×
            </button>
          </div>
        ))}
        <button className="pm-btn secondary" type="button" onClick={add}>
          + Add header
        </button>
      </div>
    </div>
  );
}
