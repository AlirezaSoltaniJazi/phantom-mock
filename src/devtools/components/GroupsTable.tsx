import { useState } from 'react';
import type { JSX } from 'react';
import type { AppState, Group, UIPreferences } from '@/shared/types';
import type { StateMutation } from '@/shared/messages';
import { moveItem } from '@/shared/groups';
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

  // Drag-to-reorder state. `dragIndex` is the row being dragged, `overIndex` the
  // row currently hovered as a drop target — both indices into the sorted list.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Inline per-group activation-condition editor. Only one panel is open at a
  // time; `draftPageUrl` holds the unsaved page-URL substring for the open group.
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [draftPageUrl, setDraftPageUrl] = useState('');

  function toggleCondition(g: Group): void {
    setExpandedGroupId((cur) => (cur === g.id ? null : g.id));
    setDraftPageUrl(g.activation?.pageUrlContains ?? '');
  }

  // Rebuild the group with (or without) an activation condition. An empty value
  // omits the `activation` key entirely (exactOptionalPropertyTypes).
  function withActivation(g: Group, pageUrlContains: string): Group {
    const base: Group = { id: g.id, name: g.name, enabled: g.enabled, order: g.order };
    if (pageUrlContains.length > 0) base.activation = { pageUrlContains };
    return base;
  }

  function saveCondition(g: Group): void {
    setExpandedGroupId(null);
    void mutate({ kind: 'upsertGroup', group: withActivation(g, draftPageUrl.trim()) });
  }

  function clearCondition(g: Group): void {
    setExpandedGroupId(null);
    setDraftPageUrl('');
    void mutate({ kind: 'upsertGroup', group: withActivation(g, '') });
  }

  function resetDrag(): void {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDrop(targetIndex: number): void {
    if (dragIndex === null || dragIndex === targetIndex) {
      resetDrag();
      return;
    }
    const orderedIds = moveItem(
      groups.map((g) => g.id),
      dragIndex,
      targetIndex
    );
    resetDrag();
    void mutate({ kind: 'reorderGroups', orderedIds });
  }

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

      {groups.map((g, i) => {
        const shown = !prefs.hiddenPopupGroupIds.includes(g.id);
        const isDragging = dragIndex === i;
        const isDropTarget = dragIndex !== null && dragIndex !== i && overIndex === i;
        const className =
          'pm-group' +
          (isDragging ? ' pm-group-dragging' : '') +
          (isDropTarget ? ' pm-group-dragover' : '');
        return (
          <div
            className={className}
            key={g.id}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overIndex !== i) setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(i);
            }}
          >
            <div className="pm-group-header">
              <span
                className="pm-drag-handle"
                role="button"
                aria-label={`Drag to reorder group ${g.name}`}
                title="Drag to reorder"
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', g.id);
                }}
                onDragEnd={resetDrag}
              >
                ⠿
              </span>
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
              {g.activation?.pageUrlContains ? (
                <span
                  className="pm-group-cond-chip"
                  title={`Active only on pages whose URL contains: ${g.activation.pageUrlContains}`}
                >
                  ⚡ page
                </span>
              ) : null}
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
                title="Limit when this group's rules apply"
                onClick={() => toggleCondition(g)}
              >
                Condition
              </button>
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
            {expandedGroupId === g.id ? (
              <div className="pm-group-condition">
                <div className="pm-field">
                  <label htmlFor={`cond-${g.id}`}>Activate only on pages whose URL contains</label>
                  <input
                    id={`cond-${g.id}`}
                    type="text"
                    placeholder="overview/therapy-details   (leave empty to always activate)"
                    value={draftPageUrl}
                    onChange={(e) => setDraftPageUrl(e.target.value)}
                  />
                </div>
                <div className="pm-row">
                  <button className="pm-btn" type="button" onClick={() => saveCondition(g)}>
                    Save
                  </button>
                  <button
                    className="pm-btn secondary"
                    type="button"
                    onClick={() => clearCondition(g)}
                  >
                    Clear
                  </button>
                </div>
                <span className="pm-debug-muted">
                  Matches the page (tab) URL in the address bar — when it contains this text, this
                  group&apos;s mock rules apply to every endpoint that page calls.
                  Header-modification rules can&apos;t see the page URL (Chrome DNR limitation) and
                  are not page-scoped.
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
