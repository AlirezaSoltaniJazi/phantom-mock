import { useState, type JSX } from 'react';
import type { AppState, Group, Rule } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { newId } from '@/utils/id';

interface Props {
  state: AppState;
  onEdit: (rule: Rule) => void;
  mutate: (mutation: StateMutation) => Promise<void>;
}

export function RulesTable({ state, onEdit, mutate }: Props): JSX.Element {
  const groups = [...state.groups].sort((a, b) => a.order - b.order);
  const rulesByGroup = new Map<string, Rule[]>();
  for (const g of groups) rulesByGroup.set(g.id, []);
  for (const r of state.rules) {
    const list = rulesByGroup.get(r.groupId);
    if (list) list.push(r);
    else rulesByGroup.set(r.groupId, [r]);
  }

  // Per-group collapse state — session-only, not persisted.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  function toggleGroupOpen(id: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function collapseAll(): void {
    setCollapsed(new Set(groups.map((g) => g.id)));
  }
  function expandAll(): void {
    setCollapsed(new Set());
  }

  function addGroup(): void {
    const name = window.prompt('Group name');
    if (!name) return;
    const group: Group = { id: newId('grp'), name, enabled: true, order: groups.length };
    void mutate({ kind: 'upsertGroup', group });
  }

  return (
    <div>
      <div className="pm-toolbar">
        <button className="pm-btn" type="button" onClick={addGroup}>
          + New group
        </button>
        <button
          className="pm-btn"
          type="button"
          onClick={() =>
            onEdit({
              id: newId('rule'),
              name: 'New rule',
              groupId: groups[0]?.id ?? 'default',
              enabled: true,
              match: { method: 'GET', urlMatchType: 'contains', urlPattern: '' },
              action: {
                kind: 'mock',
                statusCode: 200,
                delayMs: 0,
                responseBody: '{}',
                responseContentType: 'application/json',
                responseHeaders: [],
                logToPanel: true,
              },
            })
          }
        >
          + New rule
        </button>
        <div style={{ flex: 1 }} />
        <button className="pm-btn secondary" type="button" onClick={expandAll}>
          Expand all
        </button>
        <button className="pm-btn secondary" type="button" onClick={collapseAll}>
          Collapse all
        </button>
      </div>

      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        const groupRules = rulesByGroup.get(g.id) ?? [];
        return (
          <div className="pm-group" key={g.id}>
            <div className="pm-group-header">
              <button
                type="button"
                className="pm-group-chevron"
                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                aria-expanded={!isCollapsed}
                onClick={() => toggleGroupOpen(g.id)}
              >
                <span className={`pm-chevron ${isCollapsed ? 'collapsed' : ''}`} aria-hidden>
                  ▾
                </span>
              </button>
              <input
                type="checkbox"
                checked={g.enabled}
                onChange={(e) =>
                  mutate({ kind: 'toggleGroup', groupId: g.id, enabled: e.target.checked })
                }
              />
              <span className="pm-group-name">{g.name}</span>
              <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>{groupRules.length}</span>
              <button
                className="pm-btn secondary"
                type="button"
                onClick={() => {
                  const name = window.prompt('Rename group', g.name);
                  if (!name) return;
                  void mutate({ kind: 'upsertGroup', group: { ...g, name } });
                }}
              >
                Rename
              </button>
              {g.id !== 'default' ? (
                <button
                  className="pm-btn danger"
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Delete group "${g.name}"? Rules will move to Default.`))
                      return;
                    void mutate({ kind: 'deleteGroup', groupId: g.id });
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
            {isCollapsed ? null : groupRules.length === 0 ? (
              <div className="pm-empty">No rules in this group.</div>
            ) : (
              groupRules.map((rule) => (
                <div className="pm-rule" key={rule.id}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) =>
                      mutate({ kind: 'toggleRule', ruleId: rule.id, enabled: e.target.checked })
                    }
                  />
                  <span className={`pm-badge ${rule.action.kind}`}>
                    {rule.action.kind.toUpperCase()}
                  </span>
                  <span className="pm-method">{rule.match.method}</span>
                  <span className="pm-url" title={rule.match.urlPattern}>
                    <strong>{rule.name}</strong>
                    <br />
                    <small>
                      {rule.match.urlMatchType}: {rule.match.urlPattern}
                    </small>
                  </span>
                  <div className="pm-row">
                    <button className="pm-btn secondary" type="button" onClick={() => onEdit(rule)}>
                      Edit
                    </button>
                    <button
                      className="pm-btn danger"
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
                        void mutate({ kind: 'deleteRule', ruleId: rule.id });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
