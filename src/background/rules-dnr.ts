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

// Header rules apply to anything DNR can see: XHR/fetch (the original REST
// scope), plus page navigations and iframe loads (so X-Tenant-ID / Auth /
// etc. headers can be injected when the user clicks a link or opens a tab).
// Mock rules — which are NOT done through DNR — still operate only on fetch
// and XHR; that's a property of the page-world patcher in src/injected/.
const RT = chrome.declarativeNetRequest?.ResourceType;
const RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  RT?.XMLHTTPREQUEST ?? ('xmlhttprequest' as never),
  RT?.MAIN_FRAME ?? ('main_frame' as never),
  RT?.SUB_FRAME ?? ('sub_frame' as never),
];

/**
 * DNR rule IDs must be positive integers (>= 1) and fit in a 32-bit signed
 * int. If `hashStringToInt` happens to produce a value whose modulo lands on
 * 0, `updateDynamicRules` rejects the whole batch with `"id must be >= 1"` —
 * that is the most likely cause of header rules silently never landing.
 * Clamp the floor to 1 and the ceiling under 2^31 - 1.
 */
export function ruleIdFor(rule: Rule): number {
  const raw = hashStringToInt(rule.id) % 1_999_999_999; // → 0..1_999_999_998
  return raw + 1; // → 1..1_999_999_999
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
  if (!state.masterEnabled) {
    return [];
  }
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
