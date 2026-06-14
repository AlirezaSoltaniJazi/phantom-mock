import type { Group } from './types';

// Pure array move: returns a copy of `items` with the element at index `from`
// relocated to index `to` (splice semantics — remove first, then insert). Returns
// an unchanged copy when either index is out of range or `from === to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const last = items.length - 1;
  if (from === to || from < 0 || to < 0 || from > last || to > last) {
    return items.slice();
  }
  const next = items.slice();
  const moved = next.splice(from, 1);
  next.splice(to, 0, ...moved);
  return next;
}

// Reassigns each group's `order` to match the position of its id in `orderedIds`.
// Ids listed in `orderedIds` are placed first, in that exact sequence; any group
// whose id is absent (defensive — should not happen in the normal flow) is kept,
// appended after in its prior relative order. Returns a new array; group objects
// whose `order` is unchanged are returned by reference so callers can rely on
// referential stability for untouched rows.
export function reorderGroups(groups: Group[], orderedIds: string[]): Group[] {
  const rank = new Map<string, number>();
  orderedIds.forEach((id, i) => rank.set(id, i));
  const fallback = orderedIds.length;
  const sorted = [...groups].sort((a, b) => {
    const ar = rank.get(a.id);
    const br = rank.get(b.id);
    if (ar === undefined && br === undefined) return a.order - b.order;
    return (ar ?? fallback) - (br ?? fallback);
  });
  return sorted.map((g, i) => (g.order === i ? g : { ...g, order: i }));
}
