const HOST_ID = 'phantom-mock-toast-host';
const MAX_NAME_LEN = 20;
const TOAST_TTL_MS = 2600;
const MAX_TOASTS = 4;

let shadowRoot: ShadowRoot | null = null;
let stack: HTMLDivElement | null = null;

function ensureHost(): ShadowRoot | null {
  if (shadowRoot) return shadowRoot;
  if (!document.body) return null;
  const existing = document.getElementById(HOST_ID);
  if (existing && existing.shadowRoot) {
    shadowRoot = existing.shadowRoot;
    stack = shadowRoot.querySelector<HTMLDivElement>('.pm-toast-stack');
    return shadowRoot;
  }
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    'all: initial; position: fixed; bottom: 16px; right: 16px; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .pm-toast-stack {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-end;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .pm-toast {
      pointer-events: auto;
      background: rgba(28, 28, 32, 0.92);
      color: #ececef;
      padding: 6px 10px;
      border-radius: 6px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      max-width: 340px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      animation: pm-toast-in 0.18s ease-out, pm-toast-out 0.25s ease-in ${TOAST_TTL_MS - 250}ms forwards;
    }
    .pm-toast[data-kind="group"] {
      background: rgba(52, 44, 110, 0.95);
      box-shadow: 0 4px 16px rgba(80,60,200,0.35);
    }
    .pm-toast-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6ad29a;
      flex-shrink: 0;
    }
    .pm-toast-dot.group {
      background: #b3a8ff;
    }
    .pm-toast-name {
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .pm-toast-tag {
      color: #b9b9c6;
      font-size: 11px;
      flex-shrink: 0;
    }
    @keyframes pm-toast-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pm-toast-out {
      to { opacity: 0; transform: translateY(-4px); }
    }
  `;
  shadowRoot.appendChild(style);

  stack = document.createElement('div');
  stack.className = 'pm-toast-stack';
  shadowRoot.appendChild(stack);
  return shadowRoot;
}

function truncate(name: string): string {
  if (name.length <= MAX_NAME_LEN) return name;
  return `${name.slice(0, MAX_NAME_LEN - 1)}…`;
}

interface ToastSpec {
  kind: 'rule' | 'group';
  label: string;
  name: string;
  tag?: string;
}

function pushToast(spec: ToastSpec): void {
  if (!ensureHost() || !stack) return;
  while (stack.childElementCount >= MAX_TOASTS && stack.firstChild) {
    stack.firstChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'pm-toast';
  toast.dataset.kind = spec.kind;
  const dot = document.createElement('span');
  dot.className = spec.kind === 'group' ? 'pm-toast-dot group' : 'pm-toast-dot';
  const labelEl = document.createElement('span');
  labelEl.textContent = spec.label;
  const nameEl = document.createElement('span');
  nameEl.className = 'pm-toast-name';
  nameEl.textContent = truncate(spec.name);
  toast.append(dot, labelEl, nameEl);
  if (spec.tag) {
    const tagEl = document.createElement('span');
    tagEl.className = 'pm-toast-tag';
    tagEl.textContent = `· ${truncate(spec.tag)}`;
    toast.append(tagEl);
  }
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), TOAST_TTL_MS);
}

// Per-request toast (green dot). Tagged with the owning group's name when known,
// so it's clear WHICH group applied each mock.
export function showRuleAppliedToast(ruleName: string, groupName?: string): void {
  pushToast({
    kind: 'rule',
    label: 'rule applied: ',
    name: ruleName,
    ...(groupName ? { tag: groupName } : {}),
  });
}

// Distinct toast (purple) shown each time a page-conditional group's rule fires
// — i.e. the group was selected by its condition for that request.
export function showGroupActivatedToast(groupName: string): void {
  pushToast({ kind: 'group', label: 'group active: ', name: groupName });
}
