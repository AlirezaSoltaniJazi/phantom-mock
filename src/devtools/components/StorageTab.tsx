import { useCallback, useEffect, useState, type JSX } from 'react';
import type { AppState, StorageProfile, UIPreferences } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import {
  getLocalStorage,
  hasInspectedWindow,
  reloadInspectedPage,
  setLocalStorage,
} from '../inspected-window';

interface Props {
  state: AppState;
  mutate: (mutation: StateMutation) => Promise<void>;
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
  onEdit: (profile: StorageProfile) => void;
  onNew: () => void;
}

function wrapValue(profile: StorageProfile, value: string): string {
  return `${profile.prefix ?? ''}${value}${profile.suffix ?? ''}`;
}

export function StorageTab({ state, mutate, prefs, setPrefs, onEdit, onNew }: Props): JSX.Element {
  const profiles = state.storageProfiles;
  const inDevTools = hasInspectedWindow();
  const [currentValues, setCurrentValues] = useState<Record<string, string | null>>({});
  const [readErrors, setReadErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async (): Promise<void> => {
    if (!inDevTools) return;
    const next: Record<string, string | null> = {};
    const errs: Record<string, string> = {};
    await Promise.all(
      profiles.map(async (p) => {
        try {
          next[p.id] = await getLocalStorage(p.key);
        } catch (err) {
          next[p.id] = null;
          errs[p.id] = (err as Error).message;
        }
      })
    );
    setCurrentValues(next);
    setReadErrors(errs);
  }, [profiles, inDevTools]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function applyValue(profile: StorageProfile, value: string): Promise<void> {
    const final = wrapValue(profile, value);
    try {
      await setLocalStorage(profile.key, final);
      setCurrentValues((prev) => ({ ...prev, [profile.id]: final }));
      setReadErrors((prev) => {
        const { [profile.id]: _omit, ...rest } = prev;
        return rest;
      });
      if (prefs.autoReloadOnStorageSwitch) {
        reloadInspectedPage();
      }
    } catch (err) {
      setReadErrors((prev) => ({ ...prev, [profile.id]: (err as Error).message }));
    }
  }

  async function toggleAutoReload(): Promise<void> {
    await setPrefs({
      ...prefs,
      autoReloadOnStorageSwitch: !prefs.autoReloadOnStorageSwitch,
    });
  }

  return (
    <div>
      {!inDevTools ? (
        <div className="pm-notice">
          <strong>Open this panel from DevTools to use Storage.</strong> Reading and changing a
          page&apos;s <code>localStorage</code> needs <code>chrome.devtools.inspectedWindow</code>,
          which only exists when this panel is hosted inside DevTools. Right-click any page you want
          to inspect → <strong>Inspect</strong> → switch to the <strong>Phantom Mock</strong> tab →{' '}
          <strong>Storage</strong>. You can still manage your profiles from the{' '}
          <strong>Storage Editor</strong> tab in this standalone view.
        </div>
      ) : null}

      <div className="pm-toolbar">
        <button type="button" className="pm-btn" onClick={onNew}>
          + New profile
        </button>
        <button
          type="button"
          className="pm-btn secondary"
          onClick={() => reloadInspectedPage()}
          disabled={!inDevTools}
          title={inDevTools ? 'Reload the inspected page' : 'Available only inside DevTools'}
        >
          Reload page
        </button>
        <button
          type="button"
          className="pm-btn secondary"
          onClick={() => void refresh()}
          disabled={!inDevTools}
          title={
            inDevTools
              ? 'Re-read current values from the inspected page'
              : 'Available only inside DevTools'
          }
        >
          Refresh values
        </button>
        <div style={{ flex: 1 }} />
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          title="When ON, reloads the inspected page after each value switch"
        >
          <input
            type="checkbox"
            className="pm-toggle pm-toggle-sm"
            checked={prefs.autoReloadOnStorageSwitch}
            onChange={() => void toggleAutoReload()}
          />
          Auto-reload after switch
        </label>
      </div>

      {profiles.length === 0 ? (
        <div className="pm-empty">
          No storage profiles yet. Click <strong>+ New profile</strong> to add one — handy for
          locale, feature flags, tenant ids, etc.
        </div>
      ) : (
        <div className="pm-profile-list">
          {profiles.map((p) => {
            const current = currentValues[p.id];
            const err = readErrors[p.id];
            const isDisabled = !p.enabled;
            return (
              <div key={p.id} className={`pm-profile-row${isDisabled ? ' is-disabled' : ''}`}>
                <div className="pm-profile-head">
                  <span className="pm-profile-name">{p.name || '(unnamed)'}</span>
                  <div style={{ flex: 1 }} />
                  <label
                    className="pm-checkbox"
                    title={p.enabled ? 'Disable profile' : 'Enable profile'}
                  >
                    <input
                      type="checkbox"
                      className="pm-toggle pm-toggle-sm"
                      checked={p.enabled}
                      onChange={(e) =>
                        void mutate({
                          kind: 'toggleStorageProfile',
                          profileId: p.id,
                          enabled: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <button type="button" className="pm-btn secondary" onClick={() => onEdit(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pm-btn danger"
                    onClick={() => {
                      if (window.confirm(`Delete storage profile "${p.name || '(unnamed)'}"?`)) {
                        void mutate({ kind: 'deleteStorageProfile', profileId: p.id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="pm-profile-meta">
                  <span className="pm-profile-label">key</span>
                  <code className="pm-profile-key">{p.key}</code>
                </div>
                <div className="pm-profile-meta">
                  <span className="pm-profile-label">now</span>
                  <code className="pm-profile-current">
                    {!inDevTools
                      ? '(unavailable here)'
                      : current === null || current === undefined
                        ? '(not set)'
                        : current}
                  </code>
                  {inDevTools && err ? <span className="pm-error">{err}</span> : null}
                </div>
                <div className="pm-profile-meta">
                  <span className="pm-profile-label">set</span>
                  <div className="pm-chip-row">
                    {p.values.length === 0 ? (
                      <span className="pm-debug-muted">
                        No values configured — edit the profile to add some.
                      </span>
                    ) : (
                      p.values.map((v) => {
                        const wrapped = wrapValue(p, v);
                        const isWrapped = wrapped !== v;
                        return (
                          <button
                            key={v}
                            type="button"
                            className={`pm-chip${current === wrapped ? ' is-active' : ''}`}
                            disabled={isDisabled || !inDevTools}
                            onClick={() => void applyValue(p, v)}
                            title={
                              !inDevTools
                                ? 'Open this panel from DevTools to switch values'
                                : isDisabled
                                  ? 'Profile is disabled'
                                  : `Set ${p.key} = ${wrapped}`
                            }
                          >
                            {isWrapped ? wrapped : v}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
