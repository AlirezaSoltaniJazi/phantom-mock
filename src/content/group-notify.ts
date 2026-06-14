import type { AppState, Group } from '@/shared/types';

// The group a hit's rule belongs to (any group), or undefined when the rule or
// its group is unknown. Used to label "rule applied" toasts with their group and
// to detect (via `group.activation`) whether the group is page-conditional.
export function groupForRule(state: AppState, ruleId: string): Group | undefined {
  const rule = state.rules.find((r) => r.id === ruleId);
  if (!rule) return undefined;
  return state.groups.find((g) => g.id === rule.groupId);
}
