import { useState, type JSX } from 'react';
import {
  CAPTURE_EXPORT_FIELD_LABELS,
  CAPTURE_EXPORT_FIELD_ORDER,
  type CaptureExportField,
  type CaptureExportFormat,
  type CaptureExportOptions,
} from '@/shared/types';
import { buildExport, downloadArtifact } from './export';
import type { CapturedEntry } from './types';

const FORMAT_LABELS: ReadonlyArray<readonly [CaptureExportFormat, string, string]> = [
  ['files', 'One file per request (.zip)', 'A numbered .md file per request inside a zip'],
  ['single', 'Single markdown file', 'Every request in one .md, separated by rules'],
  ['json', 'JSON', 'Machine-readable array — for scripts and fixtures'],
];

interface Props {
  entries: CapturedEntry[];
  selected: CapturedEntry | null;
  options: CaptureExportOptions;
  onChange: (next: CaptureExportOptions) => void;
}

export function ExportPanel({ entries, selected, options, onChange }: Props): JSX.Element {
  const [scope, setScope] = useState<'visible' | 'selected'>('visible');
  const [status, setStatus] = useState<string | null>(null);

  const targets = scope === 'selected' && selected ? [selected] : entries;

  function toggleField(field: CaptureExportField): void {
    onChange({ ...options, fields: { ...options.fields, [field]: !options.fields[field] } });
  }

  function doExport(): void {
    if (targets.length === 0) {
      setStatus('Nothing to export — no requests match the current filters.');
      return;
    }
    try {
      const artifact = buildExport(targets, options);
      downloadArtifact(artifact);
      setStatus(
        `Exported ${targets.length} request${targets.length === 1 ? '' : 's'} to ${artifact.fileName}`
      );
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="pm-capture-panel">
      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Include</strong>
          <span className="pm-cap-panel-hint">
            The curl block already carries the request headers and body.
          </span>
        </div>
        <div className="pm-cap-chips">
          {CAPTURE_EXPORT_FIELD_ORDER.map((field) => (
            <label key={field} className="pm-checkbox">
              <input
                type="checkbox"
                checked={options.fields[field]}
                onChange={() => toggleField(field)}
              />
              {CAPTURE_EXPORT_FIELD_LABELS[field]}
            </label>
          ))}
        </div>
      </section>

      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Format</strong>
        </div>
        <div className="pm-cap-chips">
          {FORMAT_LABELS.map(([value, label, hint]) => (
            <label key={value} className="pm-checkbox" title={hint}>
              <input
                type="radio"
                name="pm-export-format"
                checked={options.format === value}
                onChange={() => onChange({ ...options, format: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="pm-cap-panel-section">
        <div className="pm-cap-panel-head">
          <strong>Scope</strong>
        </div>
        <div className="pm-cap-chips">
          <label className="pm-checkbox">
            <input
              type="radio"
              name="pm-export-scope"
              checked={scope === 'visible'}
              onChange={() => setScope('visible')}
            />
            All visible ({entries.length})
          </label>
          <label className={`pm-checkbox ${selected ? '' : 'is-muted'}`}>
            <input
              type="radio"
              name="pm-export-scope"
              disabled={!selected}
              checked={scope === 'selected'}
              onChange={() => setScope('selected')}
            />
            Selected request only
          </label>
        </div>
      </section>

      <div className="pm-cap-panel-foot">
        <button type="button" className="pm-btn" onClick={doExport}>
          Export {targets.length} request{targets.length === 1 ? '' : 's'}
        </button>
        {status ? <span className="pm-cap-panel-hint">{status}</span> : null}
      </div>
    </div>
  );
}
