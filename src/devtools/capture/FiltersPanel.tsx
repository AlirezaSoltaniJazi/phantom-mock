import type { JSX } from 'react';
import {
  CAPTURE_EXCLUDE_KIND_LABELS,
  CAPTURE_EXCLUDE_KIND_ORDER,
  CAPTURE_EXCLUDE_KIND_PLACEHOLDERS,
  CAPTURE_RESOURCE_TYPE_LABELS,
  CAPTURE_RESOURCE_TYPE_ORDER,
  DEFAULT_CAPTURE_TYPES,
  DEFAULT_CAPTURE_UNIQUE,
  type CaptureExcludeKind,
  type CaptureExcludeRule,
  type CaptureFilters,
  type CaptureResourceType,
} from '@/shared/types';
import { newId } from '@/utils/id';

interface Props {
  filters: CaptureFilters;
  onChange: (next: CaptureFilters) => void;
}

export function FiltersPanel({ filters, onChange }: Props): JSX.Element {
  function setTypes(types: Record<CaptureResourceType, boolean>): void {
    onChange({ ...filters, types });
  }

  function toggleType(type: CaptureResourceType): void {
    setTypes({ ...filters.types, [type]: !filters.types[type] });
  }

  function setAllTypes(value: boolean): void {
    const next = {} as Record<CaptureResourceType, boolean>;
    for (const type of CAPTURE_RESOURCE_TYPE_ORDER) next[type] = value;
    setTypes(next);
  }

  function updateExclude(id: string, patch: Partial<CaptureExcludeRule>): void {
    onChange({
      ...filters,
      excludes: filters.excludes.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  }

  function addExclude(): void {
    onChange({
      ...filters,
      excludes: [
        ...filters.excludes,
        { id: newId('cex'), kind: 'domain', value: '', enabled: true },
      ],
    });
  }

  function removeExclude(id: string): void {
    onChange({ ...filters, excludes: filters.excludes.filter((rule) => rule.id !== id) });
  }

  const unique = filters.unique;

  return (
    <div className="pm-capture-panel">
      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Resource types</strong>
          <div className="pm-cap-panel-actions">
            <button type="button" className="pm-btn secondary" onClick={() => setAllTypes(true)}>
              All
            </button>
            <button type="button" className="pm-btn secondary" onClick={() => setAllTypes(false)}>
              None
            </button>
            <button
              type="button"
              className="pm-btn secondary"
              onClick={() =>
                setTypes({
                  ...Object.fromEntries(CAPTURE_RESOURCE_TYPE_ORDER.map((t) => [t, false])),
                  xhr: true,
                } as Record<CaptureResourceType, boolean>)
              }
            >
              Fetch/XHR only
            </button>
          </div>
        </div>
        <div className="pm-cap-chips">
          {CAPTURE_RESOURCE_TYPE_ORDER.map((type) => (
            <button
              type="button"
              key={type}
              className={`pm-cap-chip ${filters.types[type] ? 'is-on' : ''}`}
              aria-pressed={filters.types[type]}
              onClick={() => toggleType(type)}
            >
              {CAPTURE_RESOURCE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </section>

      <section className="pm-cap-panel-section">
        <label className="pm-checkbox">
          <input
            type="checkbox"
            checked={filters.ignoreOptions}
            onChange={() => onChange({ ...filters, ignoreOptions: !filters.ignoreOptions })}
          />
          <strong>Ignore OPTIONS (CORS preflight) requests</strong>
        </label>
        <p className="pm-cap-panel-hint">
          Chrome fires a preflight before most cross-origin calls. It carries no body and shares the
          URL of the real request that follows, so it only doubles the list.
        </p>
      </section>

      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Unique requests only</strong>
          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={unique.enabled}
              onChange={() =>
                onChange({ ...filters, unique: { ...unique, enabled: !unique.enabled } })
              }
            />
            Enabled
          </label>
        </div>
        <div className="pm-cap-chips">
          {(
            [
              ['byUrl', 'URL'],
              ['byMethod', 'Method'],
              ['byRequestBody', 'Request payload'],
              ['byResponseBody', 'Response body'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={`pm-checkbox ${unique.enabled ? '' : 'is-muted'}`}>
              <input
                type="checkbox"
                disabled={!unique.enabled}
                checked={unique[key]}
                onChange={() =>
                  onChange({ ...filters, unique: { ...unique, [key]: !unique[key] } })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <p className="pm-cap-panel-hint">
          Two requests count as the same when every ticked part matches — the first one wins. With
          URL + Method, a polled endpoint is captured once; add Request payload to keep two POSTs
          that send different bodies.
        </p>
      </section>

      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Exclusions</strong>
          <button type="button" className="pm-btn secondary" onClick={addExclude}>
            + Add exclusion
          </button>
        </div>
        {filters.excludes.length === 0 ? (
          <p className="pm-cap-panel-hint">
            Nothing excluded. Add a rule to drop noise (analytics domains, HMR sockets, font files)
            before it reaches the buffer.
          </p>
        ) : (
          <div className="pm-cap-excludes">
            {filters.excludes.map((rule) => (
              <div className="pm-cap-exclude" key={rule.id}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  title="Enable this exclusion"
                  onChange={() => updateExclude(rule.id, { enabled: !rule.enabled })}
                />
                <select
                  value={rule.kind}
                  onChange={(e) =>
                    updateExclude(rule.id, { kind: e.target.value as CaptureExcludeKind })
                  }
                >
                  {CAPTURE_EXCLUDE_KIND_ORDER.map((kind) => (
                    <option key={kind} value={kind}>
                      {CAPTURE_EXCLUDE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={rule.value}
                  placeholder={CAPTURE_EXCLUDE_KIND_PLACEHOLDERS[rule.kind]}
                  onChange={(e) => updateExclude(rule.id, { value: e.target.value })}
                />
                <button
                  type="button"
                  className="pm-btn secondary"
                  onClick={() => removeExclude(rule.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pm-cap-panel-foot">
        <button
          type="button"
          className="pm-btn secondary"
          onClick={() =>
            onChange({
              excludes: [],
              types: { ...DEFAULT_CAPTURE_TYPES },
              unique: { ...DEFAULT_CAPTURE_UNIQUE },
              ignoreOptions: false,
            })
          }
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
