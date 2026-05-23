import { useMemo, useRef, useState, type JSX } from 'react';
import {
  applyImport,
  applyImportWithResolutions,
  buildSelectiveExportBundle,
  detectConflicts,
  filterBundle,
  parseExportBundle,
  type ConflictResolution,
  type ImportConflicts,
  type ImportResolutions,
} from '@/shared/import-export';
import {
  FONT_SIZE_PX,
  clampFontSize,
  type AppState,
  type ExportBundle,
  type FontSizeMode,
  type Group,
  type ImportStrategy,
  type Rule,
  type UIPreferences,
} from '@/shared/types';
import type { StateMutation } from '@/shared/messages';

interface Props {
  state: AppState;
  mutate: (mutation: StateMutation) => Promise<void>;
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
}

export function Settings({ state, mutate, prefs, setPrefs }: Props): JSX.Element {
  return (
    <div className="pm-form" style={{ maxWidth: 820 }}>
      <Appearance prefs={prefs} setPrefs={setPrefs} />
      <Notifications prefs={prefs} setPrefs={setPrefs} />
      <ExportPanel state={state} />
      <ImportPanel state={state} mutate={mutate} />
    </div>
  );
}

function Appearance({
  prefs,
  setPrefs,
}: {
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
}): JSX.Element {
  return (
    <fieldset className="pm-fieldset">
      <legend>Appearance</legend>
      <div className="pm-field">
        <label>Font size</label>
        <div className="pm-row" style={{ gap: 6 }}>
          {(['small', 'normal', 'big', 'custom'] as FontSizeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`pm-btn secondary ${prefs.fontSizeMode === mode ? 'is-active' : ''}`}
              onClick={() => void setPrefs({ ...prefs, fontSizeMode: mode })}
            >
              {mode === 'custom'
                ? `Custom (${prefs.fontSizeCustomPx}px)`
                : `${mode[0]?.toUpperCase()}${mode.slice(1)} (${FONT_SIZE_PX[mode as 'small' | 'normal' | 'big']}px)`}
            </button>
          ))}
        </div>
        {prefs.fontSizeMode === 'custom' ? (
          <div className="pm-row" style={{ marginTop: 8 }}>
            <label style={{ minWidth: 120 }}>Custom size (10–24px)</label>
            <input
              type="number"
              min={10}
              max={24}
              value={prefs.fontSizeCustomPx}
              onChange={(e) =>
                void setPrefs({
                  ...prefs,
                  fontSizeCustomPx: clampFontSize(Number(e.target.value)),
                })
              }
              style={{ width: 80 }}
            />
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function Notifications({
  prefs,
  setPrefs,
}: {
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
}): JSX.Element {
  return (
    <fieldset className="pm-fieldset">
      <legend>Notifications</legend>
      <label className="pm-checkbox">
        <input
          type="checkbox"
          checked={prefs.showToast}
          onChange={(e) => void setPrefs({ ...prefs, showToast: e.target.checked })}
        />
        Show a small in-page toast when a mock rule fires (truncated to 20 characters)
      </label>
    </fieldset>
  );
}

function ExportPanel({ state }: { state: AppState }): JSX.Element {
  const [selection, setSelection] = useState<{
    groups: Set<string>;
    rules: Set<string>;
  }>(() => allSelected(state));
  const [error, setError] = useState<string | null>(null);

  function toggleAll(): void {
    const allRules = state.rules.length === selection.rules.size;
    if (allRules) {
      setSelection({ groups: new Set(), rules: new Set() });
    } else {
      setSelection(allSelected(state));
    }
  }

  function toggleGroup(g: Group): void {
    const rulesInGroup = state.rules.filter((r) => r.groupId === g.id).map((r) => r.id);
    const allOn = rulesInGroup.every((id) => selection.rules.has(id));
    const nextRules = new Set(selection.rules);
    const nextGroups = new Set(selection.groups);
    if (allOn) {
      for (const id of rulesInGroup) nextRules.delete(id);
      nextGroups.delete(g.id);
    } else {
      for (const id of rulesInGroup) nextRules.add(id);
      nextGroups.add(g.id);
    }
    setSelection({ groups: nextGroups, rules: nextRules });
  }

  function toggleRule(r: Rule): void {
    const nextRules = new Set(selection.rules);
    if (nextRules.has(r.id)) nextRules.delete(r.id);
    else nextRules.add(r.id);
    setSelection({ ...selection, rules: nextRules });
  }

  function downloadSelection(): void {
    if (selection.rules.size === 0 && selection.groups.size === 0) {
      setError('Select at least one rule or group to export.');
      return;
    }
    setError(null);
    const bundle = buildSelectiveExportBundle(state, {
      groupIds: selection.groups,
      ruleIds: selection.rules,
    });
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phantom-mock-rules-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalRules = state.rules.length;
  const selectedCount = selection.rules.size;

  return (
    <fieldset className="pm-fieldset">
      <legend>Export</legend>
      <div className="pm-toolbar pm-toolbar-tight">
        <button type="button" className="pm-btn secondary" onClick={toggleAll}>
          {selectedCount === totalRules ? 'Deselect all' : 'Select all'}
        </button>
        <span style={{ color: 'var(--fg-muted)' }}>
          {selectedCount} of {totalRules} rule{totalRules === 1 ? '' : 's'} selected
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="pm-btn" onClick={downloadSelection}>
          Export selected
        </button>
      </div>
      <SelectionTree
        state={state}
        selection={selection}
        onToggleGroup={toggleGroup}
        onToggleRule={toggleRule}
      />
      {error ? <div className="pm-error">{error}</div> : null}
    </fieldset>
  );
}

function ImportPanel({
  state,
  mutate,
}: {
  state: AppState;
  mutate: (mutation: StateMutation) => Promise<void>;
}): JSX.Element {
  const [strategy, setStrategy] = useState<ImportStrategy>('merge-by-id');
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [selection, setSelection] = useState<{
    groups: Set<string>;
    rules: Set<string>;
  } | null>(null);
  const [conflicts, setConflicts] = useState<ImportConflicts | null>(null);
  const [resolutions, setResolutions] = useState<ImportResolutions>(() => ({
    rules: new Map(),
    groups: new Map(),
  }));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function chooseFile(file: File): Promise<void> {
    setError(null);
    setInfo(null);
    const text = await file.text();
    const parsed = parseExportBundle(text);
    if (!parsed.ok) {
      setError(parsed.error);
      setBundle(null);
      setSelection(null);
      setConflicts(null);
      return;
    }
    setBundle(parsed.value);
    setSelection({
      groups: new Set(parsed.value.groups.map((g) => g.id)),
      rules: new Set(parsed.value.rules.map((r) => r.id)),
    });
    const conf = detectConflicts(state, parsed.value);
    setConflicts(conf);
    // Default every conflict to "overwrite" (matches the legacy merge-by-id
    // behaviour). The user can flip individual conflicts to "rename".
    setResolutions({
      rules: new Map([...conf.ruleIds].map((id) => [id, 'overwrite' as const])),
      groups: new Map([...conf.groupIds].map((id) => [id, 'overwrite' as const])),
    });
  }

  function setRuleResolution(ruleId: string, res: ConflictResolution): void {
    setResolutions((prev) => ({ ...prev, rules: new Map(prev.rules).set(ruleId, res) }));
  }

  function toggleGroup(g: Group): void {
    if (!bundle || !selection) return;
    const inGroup = bundle.rules.filter((r) => r.groupId === g.id).map((r) => r.id);
    const allOn = inGroup.every((id) => selection.rules.has(id));
    const nextRules = new Set(selection.rules);
    const nextGroups = new Set(selection.groups);
    if (allOn) {
      for (const id of inGroup) nextRules.delete(id);
      nextGroups.delete(g.id);
    } else {
      for (const id of inGroup) nextRules.add(id);
      nextGroups.add(g.id);
    }
    setSelection({ groups: nextGroups, rules: nextRules });
  }

  function toggleRule(r: Rule): void {
    if (!selection) return;
    const next = new Set(selection.rules);
    if (next.has(r.id)) next.delete(r.id);
    else next.add(r.id);
    setSelection({ ...selection, rules: next });
  }

  async function performImport(): Promise<void> {
    if (!bundle || !selection) return;
    const filtered = filterBundle(bundle, {
      groupIds: selection.groups,
      ruleIds: selection.rules,
    });
    if (filtered.rules.length === 0 && filtered.groups.length === 0) {
      setError('Select at least one rule or group to import.');
      return;
    }
    const next =
      strategy === 'merge-by-id'
        ? applyImportWithResolutions(state, filtered, resolutions)
        : applyImport(state, filtered, strategy);
    await mutate({ kind: 'replaceState', state: next });
    const renames = [...resolutions.rules.values()].filter((r) => r === 'rename').length;
    setInfo(
      `Imported ${filtered.rules.length} rule(s) and ${filtered.groups.length} group(s)` +
        (strategy === 'merge-by-id' && renames > 0
          ? ` (${renames} renamed to avoid id conflict).`
          : '.')
    );
    setBundle(null);
    setSelection(null);
    setConflicts(null);
    setResolutions({ rules: new Map(), groups: new Map() });
    if (fileRef.current) fileRef.current.value = '';
  }

  const previewState = useMemo<AppState | null>(() => {
    if (!bundle) return null;
    return {
      schemaVersion: 1,
      masterEnabled: state.masterEnabled,
      groups: bundle.groups,
      rules: bundle.rules,
    };
  }, [bundle, state.masterEnabled]);

  return (
    <fieldset className="pm-fieldset">
      <legend>Import</legend>
      <div className="pm-field">
        <label>Merge strategy</label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as ImportStrategy)}>
          <option value="replace">Replace all</option>
          <option value="merge-by-id">Merge by id (overwrite duplicates)</option>
          <option value="append-as-new">Append as new (fresh ids)</option>
        </select>
      </div>
      <div className="pm-field">
        <label>Choose a Phantom Mock JSON file</label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void chooseFile(file);
          }}
        />
      </div>
      {previewState && selection ? (
        <>
          <div className="pm-toolbar pm-toolbar-tight">
            <span style={{ color: 'var(--fg-muted)' }}>
              {selection.rules.size} of {bundle?.rules.length ?? 0} rule(s) selected
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" className="pm-btn" onClick={() => void performImport()}>
              Import selected
            </button>
          </div>
          <SelectionTree
            state={previewState}
            selection={selection}
            onToggleGroup={toggleGroup}
            onToggleRule={toggleRule}
            conflicts={strategy === 'merge-by-id' ? conflicts : null}
            resolutions={resolutions}
            onSetRuleResolution={setRuleResolution}
          />
        </>
      ) : null}
      {error ? <div className="pm-error">{error}</div> : null}
      {info ? <div style={{ color: 'var(--ok)' }}>{info}</div> : null}
    </fieldset>
  );
}

interface SelectionTreeProps {
  state: AppState;
  selection: { groups: Set<string>; rules: Set<string> };
  onToggleGroup: (g: Group) => void;
  onToggleRule: (r: Rule) => void;
  conflicts?: ImportConflicts | null;
  resolutions?: ImportResolutions;
  onSetRuleResolution?: (ruleId: string, res: ConflictResolution) => void;
}

function SelectionTree({
  state,
  selection,
  onToggleGroup,
  onToggleRule,
  conflicts,
  resolutions,
  onSetRuleResolution,
}: SelectionTreeProps): JSX.Element {
  const groups = [...state.groups].sort((a, b) => a.order - b.order);
  return (
    <div className="pm-selection-tree">
      {groups.map((g) => {
        const rules = state.rules.filter((r) => r.groupId === g.id);
        const allOn = rules.length > 0 && rules.every((r) => selection.rules.has(r.id));
        const groupConflict = conflicts?.groupIds.has(g.id) ?? false;
        return (
          <div key={g.id} className="pm-selection-group">
            <label className="pm-checkbox">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (!el) return;
                  el.indeterminate = !allOn && rules.some((r) => selection.rules.has(r.id));
                }}
                onChange={() => onToggleGroup(g)}
              />
              <strong>{g.name}</strong>
              <span style={{ color: 'var(--fg-muted)' }}> · {rules.length}</span>
              {groupConflict ? (
                <span
                  className="pm-conflict-hint"
                  title="A group with this ID already exists — imported rules will land in your existing group; the existing group's name and settings are not changed."
                >
                  · merging into existing group
                </span>
              ) : null}
            </label>
            <div style={{ paddingLeft: 24 }}>
              {rules.length === 0 ? (
                <em style={{ color: 'var(--fg-muted)' }}>No rules.</em>
              ) : (
                rules.map((r) => {
                  const ruleConflict = conflicts?.ruleIds.has(r.id) ?? false;
                  const ruleResolution = resolutions?.rules.get(r.id);
                  return (
                    <div key={r.id} className="pm-selection-rule-wrap">
                      <label className="pm-checkbox" style={{ display: 'flex' }}>
                        <input
                          type="checkbox"
                          checked={selection.rules.has(r.id)}
                          onChange={() => onToggleRule(r)}
                        />
                        <span className={`pm-badge ${r.action.kind}`}>
                          {r.action.kind.toUpperCase()}
                        </span>
                        <span className="pm-method" style={{ marginLeft: 6 }}>
                          {r.match.method}
                        </span>
                        <span style={{ marginLeft: 6, flex: 1 }} title={r.match.urlPattern}>
                          <strong>{r.name}</strong>
                          <br />
                          <small style={{ color: 'var(--fg-muted)' }}>
                            {r.match.urlMatchType}: {r.match.urlPattern}
                          </small>
                        </span>
                      </label>
                      {ruleConflict && onSetRuleResolution ? (
                        <div className="pm-conflict-row">
                          <span className="pm-conflict-badge">⚠ already exists</span>
                          <ConflictRadio
                            name={`rule-${r.id}`}
                            resolution={ruleResolution}
                            onChange={(res) => onSetRuleResolution(r.id, res)}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConflictRadio({
  name,
  resolution,
  onChange,
}: {
  name: string;
  resolution: ConflictResolution | undefined;
  onChange: (res: ConflictResolution) => void;
}): JSX.Element {
  const value = resolution ?? 'overwrite';
  return (
    <span className="pm-conflict-radios" role="radiogroup">
      <label>
        <input
          type="radio"
          name={name}
          checked={value === 'overwrite'}
          onChange={() => onChange('overwrite')}
        />{' '}
        Overwrite
      </label>
      <label>
        <input
          type="radio"
          name={name}
          checked={value === 'rename'}
          onChange={() => onChange('rename')}
        />{' '}
        Rename as new
      </label>
    </span>
  );
}

function allSelected(state: AppState): { groups: Set<string>; rules: Set<string> } {
  return {
    groups: new Set(state.groups.map((g) => g.id)),
    rules: new Set(state.rules.map((r) => r.id)),
  };
}
