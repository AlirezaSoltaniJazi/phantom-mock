const HOST_ID = 'phantom-mock-toast-host';
const MAX_NAME_LEN = 20;
const TOAST_TTL_MS = 2200;
const MAX_TOASTS = 3;

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
      max-width: 320px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      animation: pm-toast-in 0.18s ease-out, pm-toast-out 0.25s ease-in ${TOAST_TTL_MS - 250}ms forwards;
    }
    .pm-toast-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6ad29a;
      flex-shrink: 0;
    }
    .pm-toast-name {
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

export function showRuleAppliedToast(ruleName: string): void {
  if (!ensureHost() || !stack) return;
  while (stack.childElementCount >= MAX_TOASTS && stack.firstChild) {
    stack.firstChild.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'pm-toast';
  const dot = document.createElement('span');
  dot.className = 'pm-toast-dot';
  const label = document.createElement('span');
  label.textContent = 'rule applied: ';
  const name = document.createElement('span');
  name.className = 'pm-toast-name';
  name.textContent = truncate(ruleName);
  toast.append(dot, label, name);
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), TOAST_TTL_MS);
}
