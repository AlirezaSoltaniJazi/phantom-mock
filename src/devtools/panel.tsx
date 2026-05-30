import { useEffect, useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppState } from './state-hook';
import { RulesTable } from './components/RulesTable';
import { RuleEditor } from './components/RuleEditor';
import { HitLog } from './components/HitLog';
import { DnrDebug } from './components/DnrDebug';
import { StorageTab } from './components/StorageTab';
import { StorageEditor } from './components/StorageEditor';
import { CookiesTab } from './components/CookiesTab';
import { CookiesEditor } from './components/CookiesEditor';
import { Settings } from './components/Settings';
import { Capture } from './capture/Capture';
import { useCapture } from './capture/use-capture';
import type { Group, Rule } from '@/shared/types';
import type { StorageProfile, CookieProfile } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/constants';
import { usePrefs, applyFontSizeVar } from '@/shared/use-prefs';
import { newId } from '@/utils/id';
import './styles.css';

type Tab =
  | 'rules'
  | 'editor'
  | 'storage'
  | 'storage-editor'
  | 'cookies'
  | 'cookies-editor'
  | 'hits'
  | 'debug'
  | 'capture'
  | 'settings';

function App(): JSX.Element {
  const { state, error, mutate } = useAppState();
  const { prefs, setPrefs, fontSizePx } = usePrefs();
  const [tab, setTab] = useState<Tab>('rules');
  const [editing, setEditing] = useState<Rule | null>(null);
  const [editingProfile, setEditingProfile] = useState<StorageProfile | null>(null);
  const [editingCookieProfile, setEditingCookieProfile] = useState<CookieProfile | null>(null);
  const [captureFilter, setCaptureFilter] = useState('');
  const [recording, setRecording] = useState(true);
  const capture = useCapture({ hostFilter: captureFilter, recording });

  useEffect(() => {
    applyFontSizeVar(document.documentElement, fontSizePx);
  }, [fontSizePx]);

  // Pull the persisted recording flag once on mount so the toggle reflects the
  // state devtools.ts is actually using.
  useEffect(() => {
    void chrome.storage.session
      .get(STORAGE_KEYS.CAPTURE_RECORDING)
      .then((r) => {
        const v = r[STORAGE_KEYS.CAPTURE_RECORDING];
        if (typeof v === 'boolean') setRecording(v);
      })
      .catch(() => undefined);
  }, []);

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

  async function createGroup(name: string): Promise<Group> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Group name is required');
    const group: Group = {
      id: newId('grp'),
      name: trimmed,
      enabled: true,
      order: state?.groups.length ?? 0,
    };
    await mutate({ kind: 'upsertGroup', group });
    return group;
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
          className={`pm-tab ${tab === 'storage' ? 'is-active' : ''}`}
          onClick={() => setTab('storage')}
        >
          Storage
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'storage-editor' ? 'is-active' : ''}`}
          onClick={() => {
            setEditingProfile(null);
            setTab('storage-editor');
          }}
        >
          Storage Editor
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'cookies' ? 'is-active' : ''}`}
          onClick={() => setTab('cookies')}
        >
          Cookies
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'cookies-editor' ? 'is-active' : ''}`}
          onClick={() => {
            setEditingCookieProfile(null);
            setTab('cookies-editor');
          }}
        >
          Cookies Editor
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
          className={`pm-tab ${tab === 'debug' ? 'is-active' : ''}`}
          onClick={() => setTab('debug')}
        >
          Debug
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'capture' ? 'is-active' : ''}`}
          onClick={() => setTab('capture')}
        >
          Capture
        </button>
        <button
          type="button"
          className={`pm-tab ${tab === 'settings' ? 'is-active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <div style={{ flex: 1 }} />
        <label
          className="pm-checkbox"
          style={{ marginRight: 12, display: 'inline-flex', gap: 8, alignItems: 'center' }}
        >
          <input
            type="checkbox"
            className="pm-toggle"
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
            key={editing?.id ?? 'new'}
            initial={editing}
            groups={state.groups}
            onCreateGroup={createGroup}
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
        {tab === 'storage' ? (
          <StorageTab
            state={state}
            mutate={mutate}
            prefs={prefs}
            setPrefs={setPrefs}
            onEdit={(profile) => {
              setEditingProfile(profile);
              setTab('storage-editor');
            }}
            onNew={() => {
              setEditingProfile(null);
              setTab('storage-editor');
            }}
          />
        ) : null}
        {tab === 'storage-editor' ? (
          <StorageEditor
            key={editingProfile?.id ?? 'new'}
            initial={editingProfile}
            onSave={(profile) => {
              void mutate({ kind: 'upsertStorageProfile', profile });
              setEditingProfile(null);
              setTab('storage');
            }}
            onCancel={() => {
              setEditingProfile(null);
              setTab('storage');
            }}
            {...(editingProfile
              ? {
                  onDelete: () => {
                    void mutate({
                      kind: 'deleteStorageProfile',
                      profileId: editingProfile.id,
                    });
                    setEditingProfile(null);
                    setTab('storage');
                  },
                }
              : {})}
          />
        ) : null}
        {tab === 'cookies' ? (
          <CookiesTab
            state={state}
            mutate={mutate}
            prefs={prefs}
            setPrefs={setPrefs}
            onEdit={(profile) => {
              setEditingCookieProfile(profile);
              setTab('cookies-editor');
            }}
            onNew={() => {
              setEditingCookieProfile(null);
              setTab('cookies-editor');
            }}
          />
        ) : null}
        {tab === 'cookies-editor' ? (
          <CookiesEditor
            key={editingCookieProfile?.id ?? 'new'}
            initial={editingCookieProfile}
            onSave={(profile) => {
              void mutate({ kind: 'upsertCookieProfile', profile });
              setEditingCookieProfile(null);
              setTab('cookies');
            }}
            onCancel={() => {
              setEditingCookieProfile(null);
              setTab('cookies');
            }}
            {...(editingCookieProfile
              ? {
                  onDelete: () => {
                    void mutate({
                      kind: 'deleteCookieProfile',
                      profileId: editingCookieProfile.id,
                    });
                    setEditingCookieProfile(null);
                    setTab('cookies');
                  },
                }
              : {})}
          />
        ) : null}
        {tab === 'hits' ? <HitLog /> : null}
        {tab === 'debug' ? <DnrDebug /> : null}
        {tab === 'capture' ? (
          <Capture
            groups={state.groups}
            mutate={mutate}
            onCreateGroup={createGroup}
            hostFilter={captureFilter}
            setHostFilter={setCaptureFilter}
            recording={recording}
            setRecording={setRecording}
            entries={capture.entries}
            clear={capture.clear}
            importFromNetworkLog={capture.importFromNetworkLog}
            reloadInspectedPage={capture.reloadInspectedPage}
            prefs={prefs}
            setPrefs={setPrefs}
          />
        ) : null}
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
