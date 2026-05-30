import { useCallback, useEffect, useState, type JSX } from 'react';
import type { AppState, CookieProfile, UIPreferences } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { getCookieValue, hasCookiesAPI, setCookieValue } from '../cookies';
import { reloadInspectedPage } from '../inspected-window';

interface Props {
  state: AppState;
  mutate: (mutation: StateMutation) => Promise<void>;
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
  onEdit: (profile: CookieProfile) => void;
  onNew: () => void;
}

function wrapValue(profile: CookieProfile, value: string): string {
  return `${profile.prefix ?? ''}${value}${profile.suffix ?? ''}`;
}

export function CookiesTab({ state, mutate, prefs, setPrefs, onEdit, onNew }: Props): JSX.Element {
  const profiles = state.cookieProfiles;
  const inDevTools = hasCookiesAPI();
  const [currentValues, setCurrentValues] = useState<Record<string, string | null>>({});
  const [readErrors, setReadErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(async (): Promise<void> => {
    if (!inDevTools) return;
    const next: Record<string, string | null> = {};
    const errs: Record<string, string> = {};
    await Promise.all(
      profiles.map(async (p) => {
        try {
          next[p.id] = await getCookieValue(p.cookieName, p.path);
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

  async function applyValue(profile: CookieProfile, value: string): Promise<void> {
    const final = wrapValue(profile, value);
    try {
      await setCookieValue(profile.cookieName, final, profile.path);
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
          <strong>Open this panel from DevTools to manage cookies on the inspected page.</strong>{' '}
          Reading and writing cookies needs <code>chrome.devtools.inspectedWindow.tabId</code>,
          which only exists when this panel is hosted inside DevTools. Right-click any page →{' '}
          <strong>Inspect</strong> → switch to the <strong>Phantom Mock</strong> tab →{' '}
          <strong>Cookies</strong>. You can still manage your profiles from the{' '}
          <strong>Cookies Editor</strong> tab in this standalone view.
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
              ? 'Re-read current cookie values from the inspected page'
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
          No cookie profiles yet. Click <strong>+ New profile</strong> to add one — handy for
          language cookies, session toggles, A/B flags, etc.
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
                          kind: 'toggleCookieProfile',
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
                      if (window.confirm(`Delete cookie profile "${p.name || '(unnamed)'}"?`)) {
                        void mutate({ kind: 'deleteCookieProfile', profileId: p.id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="pm-profile-meta">
                  <span className="pm-profile-label">cookie</span>
                  <code className="pm-profile-key">{p.cookieName}</code>
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
                                  : `Set ${p.cookieName} = ${wrapped}`
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
