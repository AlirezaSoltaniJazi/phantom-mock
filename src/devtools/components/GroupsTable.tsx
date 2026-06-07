import type { JSX } from 'react';
import type { AppState, Group, UIPreferences } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { newId } from '@/utils/id';

interface Props {
  state: AppState;
  mutate: (mutation: StateMutation) => Promise<void>;
  prefs: UIPreferences;
  setPrefs: (next: UIPreferences) => Promise<void>;
}

// Groups-only management view (the "Groups" tab). Unlike RulesTable it does NOT
// render the rules inside each group — only the groups themselves, plus a
// "Popup" toggle that controls whether the group is shown on the browser-action
// popup (a local-only UI preference, separate from the group's `enabled` flag).
export function GroupsTable({ state, mutate, prefs, setPrefs }: Props): JSX.Element {
  const groups = [...state.groups].sort((a, b) => a.order - b.order);
  const ruleCount = new Map<string, number>();
  for (const g of groups) ruleCount.set(g.id, 0);
  for (const r of state.rules) ruleCount.set(r.groupId, (ruleCount.get(r.groupId) ?? 0) + 1);

  function addGroup(): void {
    const name = window.prompt('Group name');
    if (!name) return;
    const group: Group = { id: newId('grp'), name, enabled: true, order: groups.length };
    void mutate({ kind: 'upsertGroup', group });
  }

  function setPopupVisible(groupId: string, visible: boolean): void {
    void setPrefs({
      ...prefs,
      hiddenPopupGroupIds: visible
        ? prefs.hiddenPopupGroupIds.filter((id) => id !== groupId)
        : [...prefs.hiddenPopupGroupIds, groupId],
    });
  }

  return (
    <div>
      <div className="pm-toolbar">
        <button className="pm-btn" type="button" onClick={addGroup}>
          + New group
        </button>
      </div>

      {groups.map((g) => {
        const shown = !prefs.hiddenPopupGroupIds.includes(g.id);
        return (
          <div className="pm-group" key={g.id}>
            <div className="pm-group-header">
              <input
                type="checkbox"
                className="pm-toggle pm-toggle-sm"
                title="Enable / disable this group"
                checked={g.enabled}
                onChange={(e) =>
                  mutate({ kind: 'toggleGroup', groupId: g.id, enabled: e.target.checked })
                }
              />
              <span className="pm-group-name">{g.name}</span>
              <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>
                {ruleCount.get(g.id) ?? 0}
              </span>
              <label className="pm-group-popup-toggle" title="Show this group on the popup">
                <input
                  type="checkbox"
                  className="pm-toggle pm-toggle-sm"
                  checked={shown}
                  onChange={(e) => setPopupVisible(g.id, e.target.checked)}
                />
                <span>Popup</span>
              </label>
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
          </div>
        );
      })}
    </div>
  );
}
