import { hashStringToInt } from '@/utils/id';
import type { AppState, HeaderOp, Rule } from '@/shared/types';
import { buildActiveView, isRuleActive } from '@/shared/matcher';

type DnrRule = chrome.declarativeNetRequest.Rule;
type DnrHeaderOp = chrome.declarativeNetRequest.ModifyHeaderInfo;

const HEADER_OP_MAP: Record<HeaderOp['op'], chrome.declarativeNetRequest.HeaderOperation> = {
  set: chrome.declarativeNetRequest?.HeaderOperation?.SET ?? ('set' as never),
  append: chrome.declarativeNetRequest?.HeaderOperation?.APPEND ?? ('append' as never),
  remove: chrome.declarativeNetRequest?.HeaderOperation?.REMOVE ?? ('remove' as never),
};

const RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest?.ResourceType?.XMLHTTPREQUEST ?? ('xmlhttprequest' as never),
];

function ruleIdFor(rule: Rule): number {
  return hashStringToInt(rule.id) % 2_000_000_000;
}

function toDnrHeaders(ops: HeaderOp[]): DnrHeaderOp[] {
  return ops.map((op) => {
    const base: DnrHeaderOp = { header: op.name, operation: HEADER_OP_MAP[op.op] };
    if (op.op !== 'remove' && op.value !== undefined) {
      return { ...base, value: op.value };
    }
    return base;
  });
}

function methodToDnr(
  method: Rule['match']['method']
): chrome.declarativeNetRequest.RequestMethod[] | undefined {
  if (method === '*') return undefined;
  const enumRef = chrome.declarativeNetRequest?.RequestMethod;
  if (!enumRef) return undefined;
  const mapped = (enumRef as Record<string, chrome.declarativeNetRequest.RequestMethod>)[method];
  return mapped ? [mapped] : undefined;
}

function buildCondition(rule: Rule): chrome.declarativeNetRequest.RuleCondition {
  const condition: chrome.declarativeNetRequest.RuleCondition = {
    resourceTypes: RESOURCE_TYPES,
  };
  const methods = methodToDnr(rule.match.method);
  if (methods) condition.requestMethods = methods;
  switch (rule.match.urlMatchType) {
    case 'exact':
      condition.urlFilter = `|${rule.match.urlPattern}|`;
      break;
    case 'contains':
      condition.urlFilter = rule.match.urlPattern;
      break;
    case 'regex':
      condition.regexFilter = rule.match.urlPattern;
      break;
  }
  return condition;
}

export function translateToDnrRules(state: AppState): DnrRule[] {
  if (!state.masterEnabled) return [];
  const view = buildActiveView(state);
  const out: DnrRule[] = [];
  let priority = 1;
  for (const rule of state.rules) {
    if (rule.action.kind !== 'header') continue;
    if (!isRuleActive(rule, view, state.masterEnabled)) continue;
    const requestHeaders = toDnrHeaders(rule.action.requestHeaders);
    const responseHeaders = toDnrHeaders(rule.action.responseHeaders);
    if (requestHeaders.length === 0 && responseHeaders.length === 0) continue;
    out.push({
      id: ruleIdFor(rule),
      priority: priority++,
      condition: buildCondition(rule),
      action: {
        type:
          chrome.declarativeNetRequest?.RuleActionType?.MODIFY_HEADERS ??
          ('modifyHeaders' as never),
        ...(requestHeaders.length > 0 ? { requestHeaders } : {}),
        ...(responseHeaders.length > 0 ? { responseHeaders } : {}),
      },
    });
  }
  return out;
}

export async function syncDnrRules(state: AppState): Promise<void> {
  const desired = translateToDnrRules(state);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: desired,
  });
}
