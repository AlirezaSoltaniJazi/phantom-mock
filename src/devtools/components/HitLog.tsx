import { useEffect, useState, type JSX } from 'react';
import { MESSAGE_TYPES, PORT_NAMES } from '@/shared/constants';
import { sendMessage } from '@/shared/messages';
import type { MockHit } from '@/shared/types';

type PortMessage =
  | { kind: 'snapshot'; hits: MockHit[] }
  | { kind: 'hit'; hit: MockHit }
  | { kind: 'cleared' };

export function HitLog(): JSX.Element {
  const [hits, setHits] = useState<MockHit[]>([]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: PORT_NAMES.HIT_LOG });
    const handler = (message: PortMessage): void => {
      if (message.kind === 'snapshot') setHits(message.hits);
      else if (message.kind === 'hit') setHits((prev) => [...prev, message.hit]);
      else if (message.kind === 'cleared') setHits([]);
    };
    port.onMessage.addListener(handler);
    return () => {
      port.disconnect();
    };
  }, []);

  async function clear(): Promise<void> {
    await sendMessage<{ ok: boolean }>({ type: MESSAGE_TYPES.CLEAR_HIT_LOG });
    setHits([]);
  }

  return (
    <div>
      <div className="pm-toolbar">
        <button className="pm-btn secondary" type="button" onClick={() => void clear()}>
          Clear
        </button>
        <span style={{ color: 'var(--fg-muted)' }}>{hits.length} hits</span>
      </div>
      {hits.length === 0 ? (
        <div className="pm-empty">
          No mocked requests yet. Trigger a request that matches a mock rule.
        </div>
      ) : (
        <table className="pm-hits">
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>Status</th>
              <th>Delay</th>
              <th>Rule</th>
              <th>URL</th>
            </tr>
          </thead>
          <tbody>
            {[...hits].reverse().map((h, i) => (
              <tr key={`${h.ts}-${i}`}>
                <td>{new Date(h.ts).toLocaleTimeString()}</td>
                <td>{h.method}</td>
                <td>{h.statusCode}</td>
                <td>{h.delayMs}ms</td>
                <td>{h.ruleName}</td>
                <td className="pm-url" title={h.url}>
                  {h.url}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
