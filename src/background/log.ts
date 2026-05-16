import { MAX_HIT_LOG_ENTRIES, PORT_NAMES } from '@/shared/constants';
import type { MockHit } from '@/shared/types';

const buffer: MockHit[] = [];
const subscribers = new Set<chrome.runtime.Port>();

export function recordHit(hit: MockHit): void {
  buffer.push(hit);
  if (buffer.length > MAX_HIT_LOG_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_HIT_LOG_ENTRIES);
  }
  for (const port of subscribers) {
    try {
      port.postMessage({ kind: 'hit', hit });
    } catch {
      subscribers.delete(port);
    }
  }
}

export function getHits(): MockHit[] {
  return buffer.slice();
}

export function clearHits(): void {
  buffer.length = 0;
  for (const port of subscribers) {
    try {
      port.postMessage({ kind: 'cleared' });
    } catch {
      subscribers.delete(port);
    }
  }
}

export function registerLogPortListener(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAMES.HIT_LOG) return;
    subscribers.add(port);
    port.postMessage({ kind: 'snapshot', hits: getHits() });
    port.onDisconnect.addListener(() => {
      subscribers.delete(port);
    });
  });
}
