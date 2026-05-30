import { useEffect, useState, type JSX } from 'react';
import { MAX_DNR_MATCH_ENTRIES, MESSAGE_TYPES, PORT_NAMES } from '@/shared/constants';
import { sendMessage, type DnrTestRequest } from '@/shared/messages';
import type { DnrMatchEntry } from '@/shared/types';

type DnrMatchPortMessage =
  | { kind: 'snapshot'; entries: DnrMatchEntry[] }
  | { kind: 'match'; entry: DnrMatchEntry }
  | { kind: 'cleared' };

interface DnrSyncError {
  message: string;
  translatedJson: string;
  ts: number;
}

interface DebugResponse {
  ok: boolean;
  registered?: chrome.declarativeNetRequest.Rule[];
  translated?: chrome.declarativeNetRequest.Rule[];
  lastSyncError?: DnrSyncError | null;
  error?: string;
}

interface TestResponse {
  ok: boolean;
  matchedRules?: chrome.declarativeNetRequest.MatchedRule[];
  error?: string;
}

const RESOURCE_TYPE_OPTIONS: chrome.declarativeNetRequest.ResourceType[] = [
  'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
  'main_frame' as chrome.declarativeNetRequest.ResourceType,
  'sub_frame' as chrome.declarativeNetRequest.ResourceType,
];

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export function DnrDebug(): JSX.Element {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testMethod, setTestMethod] = useState<string>('GET');
  const [testType, setTestType] = useState<chrome.declarativeNetRequest.ResourceType>(
    RESOURCE_TYPE_OPTIONS[0]!
  );
  const [testResult, setTestResult] = useState<TestResponse | null>(null);
  const [matches, setMatches] = useState<DnrMatchEntry[]>([]);

  async function fetchDebug(): Promise<DebugResponse> {
    try {
      return await sendMessage<DebugResponse>({ type: MESSAGE_TYPES.GET_DNR_DEBUG });
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async function refresh(): Promise<void> {
    setLoading(true);
    const resp = await fetchDebug();
    setData(resp);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchDebug().then((resp) => {
      if (!cancelled) setData(resp);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: PORT_NAMES.DNR_MATCH_LOG });
    function onMessage(msg: DnrMatchPortMessage): void {
      if (msg.kind === 'snapshot') {
        setMatches(msg.entries);
      } else if (msg.kind === 'match') {
        setMatches((prev) => [msg.entry, ...prev].slice(0, MAX_DNR_MATCH_ENTRIES));
      } else if (msg.kind === 'cleared') {
        setMatches([]);
      }
    }
    port.onMessage.addListener(onMessage);
    return () => {
      port.disconnect();
    };
  }, []);

  async function clearMatches(): Promise<void> {
    try {
      await sendMessage({ type: MESSAGE_TYPES.CLEAR_DNR_MATCH_LOG });
    } catch {
      // ignore — UI still clears below
    }
    setMatches([]);
  }

  async function runTest(): Promise<void> {
    if (!testUrl.trim()) return;
    try {
      const request: DnrTestRequest = {
        url: testUrl.trim(),
        method: testMethod,
        type: testType,
      };
      const resp = await sendMessage<TestResponse>({
        type: MESSAGE_TYPES.TEST_DNR_MATCH,
        request,
      });
      setTestResult(resp);
    } catch (err) {
      setTestResult({ ok: false, error: (err as Error).message });
    }
  }

  const registered = data?.registered ?? [];
  const translated = data?.translated ?? [];
  const lastSyncError = data?.lastSyncError ?? null;

  return (
    <div className="pm-debug">
      <div className="pm-toolbar">
        <button className="pm-btn secondary" type="button" onClick={() => void refresh()}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <span style={{ color: 'var(--fg-muted)' }}>
          {registered.length} registered · {translated.length} translated
        </span>
      </div>

      {data?.error ? (
        <div className="pm-empty" style={{ color: 'var(--danger)' }}>
          Error: {data.error}
        </div>
      ) : null}

      <section className="pm-debug-section">
        <div className="pm-toolbar">
          <h3 className="pm-debug-heading" style={{ flex: 1, margin: 0 }}>
            Live DNR matches
          </h3>
          <span style={{ color: 'var(--fg-muted)' }}>{matches.length} matches</span>
          <button className="pm-btn secondary" type="button" onClick={() => void clearMatches()}>
            Clear
          </button>
        </div>
        {matches.length === 0 ? (
          <div className="pm-debug-muted">
            No header rules have matched yet. Trigger a request that one of your rules covers.
          </div>
        ) : (
          <table className="pm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Rule</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((entry, idx) => (
                <tr key={`${entry.ts}-${idx}`}>
                  <td>{new Date(entry.ts).toLocaleTimeString()}</td>
                  <td>{entry.method}</td>
                  <td>{entry.ruleName ?? `#${entry.dnrRuleId}`}</td>
                  <td>{entry.url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="pm-debug-section">
        <h3 className="pm-debug-heading">Last sync error</h3>
        {lastSyncError ? (
          <div className="pm-debug-error">
            <div>
              <strong>{lastSyncError.message}</strong>
            </div>
            <div className="pm-debug-muted">
              At {new Date(lastSyncError.ts).toLocaleTimeString()}
            </div>
            <pre className="pm-debug-pre">{lastSyncError.translatedJson}</pre>
          </div>
        ) : (
          <div className="pm-debug-muted">None — last sync succeeded.</div>
        )}
      </section>

      <section className="pm-debug-section">
        <h3 className="pm-debug-heading">Test against URL</h3>
        <div className="pm-debug-form">
          <input
            type="text"
            className="pm-input"
            placeholder="https://api.example.com/v1/users"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="pm-input"
            value={testMethod}
            onChange={(e) => setTestMethod(e.target.value)}
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="pm-input"
            value={testType}
            onChange={(e) =>
              setTestType(e.target.value as chrome.declarativeNetRequest.ResourceType)
            }
          >
            {RESOURCE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="pm-btn" type="button" onClick={() => void runTest()}>
            Test
          </button>
        </div>
        {testResult ? (
          testResult.ok ? (
            testResult.matchedRules && testResult.matchedRules.length > 0 ? (
              <div className="pm-debug-result">
                <strong>{testResult.matchedRules.length} matching rule(s):</strong>
                <pre className="pm-debug-pre">
                  {JSON.stringify(testResult.matchedRules, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="pm-debug-muted">No rules match this URL.</div>
            )
          ) : (
            <div className="pm-debug-error">Error: {testResult.error}</div>
          )
        ) : null}
      </section>

      <section className="pm-debug-section">
        <h3 className="pm-debug-heading">Registered dynamic rules</h3>
        {registered.length === 0 ? (
          <div className="pm-debug-muted">
            No DNR rules registered. Header rules (and only header rules) appear here.
          </div>
        ) : (
          <pre className="pm-debug-pre">{JSON.stringify(registered, null, 2)}</pre>
        )}
      </section>

      <section className="pm-debug-section">
        <h3 className="pm-debug-heading">Translated rules (from current state)</h3>
        {translated.length === 0 ? (
          <div className="pm-debug-muted">No rules to translate.</div>
        ) : (
          <pre className="pm-debug-pre">{JSON.stringify(translated, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
