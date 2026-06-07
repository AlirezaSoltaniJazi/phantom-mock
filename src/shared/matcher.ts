import type { AppState, Group, HttpMethod, MatchSpec, Rule } from './types';
import { compileTemplate } from './template';

export function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export function methodMatches(specMethod: HttpMethod, actual: string): boolean {
  if (specMethod === '*') return true;
  return specMethod.toUpperCase() === actual.toUpperCase();
}

export function urlMatches(spec: MatchSpec, url: string): boolean {
  switch (spec.urlMatchType) {
    case 'exact':
      return url === spec.urlPattern;
    case 'contains':
      return spec.urlPattern.length > 0 && url.includes(spec.urlPattern);
    case 'regex': {
      const re = compileRegex(spec.urlPattern);
      return re !== null && re.test(url);
    }
    case 'template': {
      const re = compileTemplate(spec.urlPattern);
      return re !== null && re.test(url);
    }
    default:
      return false;
  }
}

export function specMatches(spec: MatchSpec, url: string, method: string): boolean {
  return methodMatches(spec.method, method) && urlMatches(spec, url);
}

export interface ActiveRulesView {
  groups: Group[];
  rules: Rule[];
  groupEnabled: Map<string, boolean>;
}

export function buildActiveView(state: AppState): ActiveRulesView {
  const groupEnabled = new Map<string, boolean>();
  for (const group of state.groups) {
    groupEnabled.set(group.id, group.enabled);
  }
  return { groups: state.groups, rules: state.rules, groupEnabled };
}

export function isRuleActive(rule: Rule, view: ActiveRulesView, masterEnabled: boolean): boolean {
  if (!masterEnabled) return false;
  if (!rule.enabled) return false;
  const groupOn = view.groupEnabled.get(rule.groupId);
  if (groupOn === false) return false;
  return true;
}

export function findFirstMockMatch(state: AppState, url: string, method: string): Rule | undefined {
  if (!state.masterEnabled) return undefined;
  const view = buildActiveView(state);
  for (const rule of state.rules) {
    if (rule.action.kind !== 'mock') continue;
    if (!isRuleActive(rule, view, state.masterEnabled)) continue;
    if (specMatches(rule.match, url, method)) {
      return rule;
    }
  }
  return undefined;
}
