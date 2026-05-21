import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { MESSAGE_TYPES } from '@/shared/constants';
import { isRuntimeMessage, sendMessage, type StateMutation } from '@/shared/messages';
import type { AppState, Rule } from '@/shared/types';
import { applyFontSizeVar, usePrefs } from '@/shared/use-prefs';
import {
  bucketByBaseDomain,
  bucketBySubdomain,
  deriveUrlParts,
  ruleToUrl,
} from '@/shared/url-parts';
import './styles.css';

function Popup(): JSX.Element {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { fontSizePx } = usePrefs();

  useEffect(() => {
    applyFontSizeVar(document.documentElement, fontSizePx);
  }, [fontSizePx]);

  useEffect(() => {
    void refresh();
    const handler = (message: unknown): void => {
      if (!isRuntimeMessage(message)) return;
      if (message.type === MESSAGE_TYPES.RULES_UPDATED) {
        setState(message.state);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function refresh(): Promise<void> {
    try {
      const response = await sendMessage<{ ok: boolean; state?: AppState; error?: string }>({
        type: MESSAGE_TYPES.GET_STATE,
      });
      if (response.ok && response.state) {
        setState(response.state);
        setError(null);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function mutate(mutation: StateMutation): Promise<void> {
    const response = await sendMessage<{ ok: boolean; state?: AppState; error?: string }>({
      type: MESSAGE_TYPES.MUTATE_STATE,
      mutation,
    });
    if (response.ok && response.state) setState(response.state);
  }

  function openPanel(): void {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/devtools/panel.html') });
  }

  if (error)
    return (
      <div className="pop-empty" style={{ color: 'var(--danger)' }}>
        {error}
      </div>
    );
  if (!state) return <div className="pop-empty">Loading…</div>;

  const groups = [...state.groups].sort((a, b) => a.order - b.order);
  const rulesByGroup = new Map<string, Rule[]>();
  for (const g of groups) rulesByGroup.set(g.id, []);
  for (const r of state.rules) {
    const list = rulesByGroup.get(r.groupId) ?? [];
    list.push(r);
    rulesByGroup.set(r.groupId, list);
  }

  return (
    <div className="pop">
      <div className="pop-header">
        <span className="pop-title">Phantom Mock</span>
        <label className="pop-master">
          <input
            type="checkbox"
            checked={state.masterEnabled}
            onChange={(e) => mutate({ kind: 'setMasterEnabled', enabled: e.target.checked })}
          />
          On
        </label>
      </div>
      <div className="pop-body">
        {state.rules.length === 0 ? (
          <div className="pop-empty">
            No rules yet. Open the DevTools panel "Phantom Mock" to create your first rule.
          </div>
        ) : (
          groups.map((g) => {
            const groupRules = rulesByGroup.get(g.id) ?? [];
            const buckets = bucketByBaseDomain(groupRules, ruleToUrl);
            return (
              <div key={g.id}>
                <div className="pop-group">
                  <input
                    type="checkbox"
                    checked={g.enabled}
                    onChange={(e) =>
                      mutate({ kind: 'toggleGroup', groupId: g.id, enabled: e.target.checked })
                    }
                  />
                  <span style={{ flex: 1 }}>{g.name}</span>
                  <small>{groupRules.length}</small>
                </div>
                {buckets.map((bucket, bi) => {
                  const subBuckets = bucketBySubdomain(bucket.items, ruleToUrl);
                  return (
                    <div className="pop-host-bucket" key={`${g.id}-${bi}`}>
                      <div className="pop-host" title={bucket.baseDomain ?? 'No host'}>
                        <SchemeIcon scheme={bucket.scheme} />
                        <span className="pop-host-name">{bucket.baseDomain ?? '(no host)'}</span>
                        <small>{bucket.items.length}</small>
                      </div>
                      {subBuckets.map((sub, si) => (
                        <div className="pop-subhost-bucket" key={`${g.id}-${bi}-${si}`}>
                          <div
                            className="pop-subhost"
                            title={sub.subdomain ?? `(${bucket.baseDomain ?? 'no host'})`}
                          >
                            <span className="pop-subhost-name">{sub.subdomain ?? '(root)'}</span>
                            <small>{sub.items.length}</small>
                          </div>
                          {sub.items.map((rule) => {
                            const parts = deriveUrlParts(rule);
                            return (
                              <div className="pop-rule" key={rule.id}>
                                <input
                                  type="checkbox"
                                  checked={rule.enabled}
                                  onChange={(e) =>
                                    mutate({
                                      kind: 'toggleRule',
                                      ruleId: rule.id,
                                      enabled: e.target.checked,
                                    })
                                  }
                                />
                                <span className={`pop-badge ${rule.action.kind}`}>
                                  {rule.action.kind.toUpperCase()}
                                </span>
                                <span className="pop-method">{rule.match.method}</span>
                                <span
                                  className="pop-path"
                                  title={`${rule.name}\n${rule.match.urlMatchType}: ${rule.match.urlPattern}`}
                                >
                                  <span className="pop-path-text">{parts.path || '/'}</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
      <div className="pop-footer">
        <button className="pop-btn secondary" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
        <button className="pop-btn" type="button" onClick={openPanel}>
          Open editor
        </button>
      </div>
    </div>
  );
}

function SchemeIcon({ scheme }: { scheme: 'http' | 'https' | 'other' | null }): JSX.Element {
  if (scheme === 'https') {
    return (
      <svg
        className="pop-scheme-icon"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-label="https"
      >
        <path
          d="M5 7V5a3 3 0 0 1 6 0v2h.5a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1 0h4V5a2 2 0 1 0-4 0v2Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (scheme === 'http') {
    return (
      <svg className="pop-scheme-icon" viewBox="0 0 16 16" width="12" height="12" aria-label="http">
        <path
          d="M11 7V5a3 3 0 0 0-5.83-1.06l.97.34A2 2 0 0 1 10 5v2H4.5A1.5 1.5 0 0 0 3 8.5v4A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 11.5 7H11Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      className="pop-scheme-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-label="endpoint"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 8h12M8 2c2 1.8 3 3.8 3 6s-1 4.2-3 6c-2-1.8-3-3.8-3-6s1-4.2 3-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Popup />);
