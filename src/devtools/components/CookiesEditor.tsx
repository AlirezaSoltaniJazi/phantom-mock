import { useMemo, useState, type JSX } from 'react';
import type { CookieProfile } from '@/shared/types';
import { newId } from '@/utils/id';

interface Props {
  initial: CookieProfile | null;
  onSave: (profile: CookieProfile) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function emptyDraft(): CookieProfile {
  return {
    id: newId('cprof'),
    name: '',
    cookieName: '',
    values: [],
    enabled: true,
  };
}

function valuesToText(values: string[]): string {
  return values.join('\n');
}

function textToValues(text: string): string[] {
  return text
    .split('\n')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function CookiesEditor({ initial, onSave, onCancel, onDelete }: Props): JSX.Element {
  const [draft, setDraft] = useState<CookieProfile>(initial ?? emptyDraft());
  const [valuesText, setValuesText] = useState<string>(valuesToText(draft.values));
  // Progressive disclosure: prefix/suffix inputs only appear after the user
  // clicks "+ Add prefix" / "+ Add suffix". For existing profiles where one is
  // already configured, start them open.
  const [showPrefix, setShowPrefix] = useState<boolean>(typeof draft.prefix === 'string');
  const [showSuffix, setShowSuffix] = useState<boolean>(typeof draft.suffix === 'string');

  const nameError = draft.name.trim().length === 0 ? 'Name is required.' : null;
  const cookieNameError = draft.cookieName.trim().length === 0 ? 'Cookie name is required.' : null;
  const parsedValues = useMemo(() => textToValues(valuesText), [valuesText]);
  const valuesError =
    parsedValues.length === 0 ? 'Add at least one candidate value (one per line).' : null;
  const canSave = !nameError && !cookieNameError && !valuesError;

  function handleSave(): void {
    if (!canSave) return;
    const next: CookieProfile = {
      id: draft.id,
      name: draft.name.trim(),
      cookieName: draft.cookieName.trim(),
      values: parsedValues,
      enabled: draft.enabled,
    };
    // Path is optional — only persist when the user actually entered one. The
    // SW defaults to '/' when omitted, so leaving the field blank yields the
    // most permissive scoping.
    const trimmedPath = draft.path?.trim();
    if (typeof trimmedPath === 'string' && trimmedPath.length > 0) {
      next.path = trimmedPath;
    }
    if (showPrefix) next.prefix = draft.prefix ?? '';
    if (showSuffix) next.suffix = draft.suffix ?? '';
    onSave(next);
  }

  const sampleValue = parsedValues[0] ?? '<value>';
  const previewPrefix = showPrefix ? (draft.prefix ?? '') : '';
  const previewSuffix = showSuffix ? (draft.suffix ?? '') : '';
  const showPreview = showPrefix || showSuffix;

  return (
    <div className="pm-form">
      <div className="pm-field">
        <label>Name</label>
        <input
          type="text"
          value={draft.name}
          placeholder="Preferred language"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        {nameError ? <div className="pm-error">{nameError}</div> : null}
      </div>

      <div className="pm-field">
        <label>Cookie name</label>
        <input
          type="text"
          value={draft.cookieName}
          placeholder="app_locale"
          onChange={(e) => setDraft({ ...draft, cookieName: e.target.value })}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
        {cookieNameError ? <div className="pm-error">{cookieNameError}</div> : null}
      </div>

      <div className="pm-field">
        <label>Path (optional)</label>
        <input
          type="text"
          value={draft.path ?? ''}
          placeholder="/"
          onChange={(e) => setDraft({ ...draft, path: e.target.value })}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
        <div className="pm-debug-muted" style={{ marginTop: 4 }}>
          Leave blank to default to <code>/</code> (visible across the whole origin).
        </div>
      </div>

      <div className="pm-field">
        <label>Candidate values (one per line)</label>
        <textarea
          value={valuesText}
          placeholder={'en\nde\nfr'}
          onChange={(e) => setValuesText(e.target.value)}
          rows={6}
        />
        {valuesError ? <div className="pm-warn">{valuesError}</div> : null}
      </div>

      <div className="pm-field">
        <label>Value wrapping</label>
        <div className="pm-toolbar pm-toolbar-tight">
          {!showPrefix ? (
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => setShowPrefix(true)}
              title="Prepend a fixed string to every value before setting it"
            >
              + Add prefix
            </button>
          ) : null}
          {!showSuffix ? (
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => setShowSuffix(true)}
              title="Append a fixed string to every value before setting it"
            >
              + Add suffix
            </button>
          ) : null}
          {!showPrefix && !showSuffix ? (
            <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
              Wrap each value before it lands in the cookie — useful for JSON quoting (
              <code>"</code> &hellip; <code>"</code>) or embedding values in a larger shape.
            </span>
          ) : null}
        </div>
        {showPrefix ? (
          <div className="pm-row" style={{ marginTop: 6 }}>
            <label style={{ minWidth: 60, color: 'var(--fg-muted)', fontWeight: 600 }}>
              Prefix
            </label>
            <input
              type="text"
              value={draft.prefix ?? ''}
              placeholder={'"'}
              onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
              style={{
                flex: 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            />
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => {
                setShowPrefix(false);
                const { prefix: _omit, ...rest } = draft;
                setDraft(rest);
              }}
              title="Remove prefix"
            >
              ×
            </button>
          </div>
        ) : null}
        {showSuffix ? (
          <div className="pm-row" style={{ marginTop: 6 }}>
            <label style={{ minWidth: 60, color: 'var(--fg-muted)', fontWeight: 600 }}>
              Suffix
            </label>
            <input
              type="text"
              value={draft.suffix ?? ''}
              placeholder={'"'}
              onChange={(e) => setDraft({ ...draft, suffix: e.target.value })}
              style={{
                flex: 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            />
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() => {
                setShowSuffix(false);
                const { suffix: _omit, ...rest } = draft;
                setDraft(rest);
              }}
              title="Remove suffix"
            >
              ×
            </button>
          </div>
        ) : null}
        {showPreview ? (
          <div className="pm-debug-muted" style={{ marginTop: 6 }}>
            Each value will be stored as{' '}
            <code>
              {previewPrefix}
              {sampleValue}
              {previewSuffix}
            </code>
          </div>
        ) : null}
      </div>

      <div className="pm-field">
        <label className="pm-checkbox">
          <input
            type="checkbox"
            className="pm-toggle pm-toggle-sm"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>

      <div className="pm-toolbar">
        <button type="button" className="pm-btn" disabled={!canSave} onClick={handleSave}>
          Save
        </button>
        <button type="button" className="pm-btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <div style={{ flex: 1 }} />
        {onDelete ? (
          <button
            type="button"
            className="pm-btn danger"
            onClick={() => {
              if (window.confirm(`Delete cookie profile "${draft.name || '(unnamed)'}"?`)) {
                onDelete();
              }
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
