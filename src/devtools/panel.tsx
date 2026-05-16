import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppState } from './state-hook';
import { RulesTable } from './components/RulesTable';
import { RuleEditor } from './components/RuleEditor';
import { HitLog } from './components/HitLog';
import { Settings } from './components/Settings';
import type { Rule } from '@/shared/types';
import { usePrefs, applyFontSizeVar } from '@/shared/use-prefs';
import './styles.css';

type Tab = 'rules' | 'editor' | 'hits' | 'settings';

function App(): JSX.Element {
  const { state, error, mutate } = useAppState();
  const { prefs, setPrefs, fontSizePx } = usePrefs();
  const [tab, setTab] = useState<Tab>('rules');
  const [editing, setEditing] = useState<Rule | null>(null);

  useEffect(() => {
    applyFontSizeVar(document.documentElement, fontSizePx);
  }, [fontSizePx]);

  if (error) return <div style={{ padding: 16, color: 'var(--danger)' }}>Error: {error}</div>;
  if (!state) return <div style={{ padding: 16 }}>Loading…</div>;

  function startEdit(rule: Rule): void {
    setEditing(rule);
    setTab('editor');
  }

  async function save(rule: Rule): Promise<void> {
    await mutate({ kind: 'upsertRule', rule });
    setEditing(null);
    setTab('rules');
  }

  return (
    <div className="pm-app">
      <div className="pm-tabs">
        <button
          type="button"
          className={`pm-tab ${tab === 'rules' ? 'is-active' : ''}`}
          onClick={() => setTab('rules')}
        >
          Rules
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'editor' ? 'is-active' : ''}`}
          onClick={() => {
            setEditing(null);
            setTab('editor');
          }}
        >
          Editor
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'hits' ? 'is-active' : ''}`}
          onClick={() => setTab('hits')}
        >
          Hit Log
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'settings' ? 'is-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <div style={{ flex: 1 }} />
        <label className="pm-checkbox" style={{ marginRight: 12 }}>
          <input
            type="checkbox"
            checked={state.masterEnabled}
            onChange={(e) => mutate({ kind: 'setMasterEnabled', enabled: e.target.checked })}
          />
          Phantom Mock {state.masterEnabled ? 'enabled' : 'disabled'}
        </label>
      </div>
      <div className="pm-content">
        {tab === 'rules' ? <RulesTable state={state} onEdit={startEdit} mutate={mutate} /> : null}
        {tab === 'editor' ? (
          <RuleEditor
            initial={editing}
            groups={state.groups}
            onSave={(rule) => void save(rule)}
            onCancel={() => {
              setEditing(null);
              setTab('rules');
            }}
            onDelete={
              editing
                ? () => {
                    void mutate({ kind: 'deleteRule', ruleId: editing.id });
                    setEditing(null);
                    setTab('rules');
                  }
                : undefined
            }
          />
        ) : null}
        {tab === 'hits' ? <HitLog /> : null}
        {tab === 'settings' ? (
          <Settings state={state} mutate={mutate} prefs={prefs} setPrefs={setPrefs} />
        ) : null}
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
