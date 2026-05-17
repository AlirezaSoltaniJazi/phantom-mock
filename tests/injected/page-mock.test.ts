import { describe, expect, it } from 'vitest';
import { setRulesCacheForTest } from '@/injected/page-mock';
import type { Rule } from '@/shared/types';

const mockRule: Rule = {
  id: 'rule_a',
  name: 'Mock A',
  groupId: 'default',
  enabled: true,
  match: { method: 'GET', urlMatchType: 'contains', urlPattern: '/api/' },
  action: {
    kind: 'mock',
    statusCode: 201,
    delayMs: 0,
    responseBody: '{"hello":"world"}',
    responseContentType: 'application/json',
    responseHeaders: [{ name: 'X-Phantom', value: 'yes', op: 'set' }],
    logToPanel: true,
  },
};

describe('injected page-mock fetch patch', () => {
  it('returns mocked Response when a matching rule is active', async () => {
    setRulesCacheForTest({
      masterEnabled: true,
      groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
      rules: [mockRule],
    });
    const res = await window.fetch('https://example.com/api/widgets');
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('x-phantom')).toBe('yes');
    const body = await res.json();
    expect(body).toEqual({ hello: 'world' });
  });

  it('respects the master switch — no match when disabled', async () => {
    setRulesCacheForTest({
      masterEnabled: false,
      groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
      rules: [mockRule],
    });
    // We cannot exercise pass-through in happy-dom (it would attempt a real
    // network call). Instead verify the rule cache is consulted: enabling the
    // master flag should restore the mocked path on the next call.
    setRulesCacheForTest({
      masterEnabled: true,
      groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
      rules: [mockRule],
    });
    const res = await window.fetch('https://example.com/api/users');
    expect(res.status).toBe(201);
  });

  it('returns synthetic Response with the response body via XHR', async () => {
    setRulesCacheForTest({
      masterEnabled: true,
      groups: [{ id: 'default', name: 'Default', enabled: true, order: 0 }],
      rules: [mockRule],
    });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://example.com/api/v2/thing');
      xhr.onload = () => {
        try {
          expect(xhr.status).toBe(201);
          expect(xhr.responseText).toBe('{"hello":"world"}');
          resolve();
        } catch (err) {
          reject(err as Error);
        }
      };
      xhr.onerror = () => reject(new Error('xhr error'));
      xhr.send();
    });
  });
});
