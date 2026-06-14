import { describe, expect, it } from 'vitest';
import { moveItem, reorderGroups } from '@/shared/groups';
import type { Group } from '@/shared/types';

function makeGroup(id: string, order: number): Group {
  return { id, name: id.toUpperCase(), enabled: true, order };
}

describe('moveItem', () => {
  it('moves an element down to a later index (splice semantics)', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an element up to an earlier index', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('swaps adjacent neighbours', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('returns an unchanged copy when from === to', () => {
    const input = ['a', 'b', 'c'];
    const out = moveItem(input, 1, 1);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('returns an unchanged copy when an index is out of range', () => {
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('reorderGroups', () => {
  it('reassigns order to match the supplied id sequence', () => {
    const groups = [makeGroup('a', 0), makeGroup('b', 1), makeGroup('c', 2)];
    const result = reorderGroups(groups, ['c', 'a', 'b']);
    const byId = Object.fromEntries(result.map((g) => [g.id, g.order]));
    expect(byId).toEqual({ c: 0, a: 1, b: 2 });
  });

  it('returns groups sorted by their new order', () => {
    const groups = [makeGroup('a', 0), makeGroup('b', 1), makeGroup('c', 2)];
    const result = reorderGroups(groups, ['b', 'c', 'a']);
    expect(result.map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps untouched group objects referentially stable', () => {
    const groups = [makeGroup('a', 0), makeGroup('b', 1), makeGroup('c', 2)];
    const a = groups[0];
    // 'a' stays at index 0, so its object should be returned by reference.
    const result = reorderGroups(groups, ['a', 'c', 'b']);
    expect(result.find((g) => g.id === 'a')).toBe(a);
    expect(result.find((g) => g.id === 'b')).not.toBe(groups[1]);
  });

  it('appends ids missing from orderedIds after the listed ones, preserving prior order', () => {
    const groups = [makeGroup('a', 0), makeGroup('b', 1), makeGroup('c', 2)];
    // 'c' omitted — it should land last, keeping the contiguous 0..n-1 ordering.
    const result = reorderGroups(groups, ['b', 'a']);
    expect(result.map((g) => g.id)).toEqual(['b', 'a', 'c']);
    expect(result.map((g) => g.order)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input array', () => {
    const groups = [makeGroup('a', 0), makeGroup('b', 1)];
    const snapshot = groups.map((g) => ({ ...g }));
    reorderGroups(groups, ['b', 'a']);
    expect(groups).toEqual(snapshot);
  });
});
