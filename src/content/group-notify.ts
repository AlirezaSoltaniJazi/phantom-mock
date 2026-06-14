import type { AppState, Group } from '@/shared/types';

// Returns the group a hit's rule belongs to ONLY when that group has a page-URL
// activation condition — i.e. the rule fired because the group was selected by
// its condition. Returns undefined for rules in unconditional groups (or when
// the rule/group is unknown), so callers notify only for conditional groups.
export function conditionalGroupForHit(state: AppState, ruleId: string): Group | undefined {
  const rule = state.rules.find((r) => r.id === ruleId);
  if (!rule) return undefined;
  const group = state.groups.find((g) => g.id === rule.groupId);
  return group?.activation?.pageUrlContains ? group : undefined;
}
