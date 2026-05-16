/**
 * Content script template for phantom-mock.
 * Copy and adapt for new content script features.
 */

// Type imports
import type { ExtensionMessage, MessageResponse } from '@/shared/types';

// Value imports
import { MESSAGE_TYPES } from '@/shared/messages';
import { sendMessage } from '@/shared/messages';

// Constants
const HOST_ELEMENT_TAG = 'phantom-mock-root';

// State (minimal — prefer chrome.storage for persistence)
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

// --- Initialization ---

function init(): void {
  // Check if already injected
  if (document.querySelector(HOST_ELEMENT_TAG)) {
    return;
  }

  // Register message listener
  chrome.runtime.onMessage.addListener(handleMessage);

  // Inject UI if needed
  injectUI();

  // Set up DOM observation if needed
  observeDOM();
}

// --- Message Handling ---

function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
): boolean {
  switch (message.type) {
    case MESSAGE_TYPES.RULES_UPDATED:
      handleRulesUpdated(message.payload);
      sendResponse({ success: true });
      return false; // Synchronous response

    default:
      return false;
  }
}

function handleRulesUpdated(payload: unknown): void {
  // Update UI based on new rules
  updateIndicator();
}

// --- UI Injection (Shadow DOM) ---

function injectUI(): void {
  // Create host element with custom tag (won't conflict with page)
  hostElement = document.createElement(HOST_ELEMENT_TAG);

  // Closed shadow — page cannot access our DOM
  shadowRoot = hostElement.attachShadow({ mode: 'closed' });

  // Scoped styles — won't leak to page
  const styles = document.createElement('style');
  styles.textContent = `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
    }
    .indicator {
      position: fixed;
      bottom: 16px;
      right: 16px;
      padding: 8px 12px;
      border-radius: 6px;
      background: #4CAF50;
      color: white;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      pointer-events: auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  `;

  shadowRoot.appendChild(styles);
  document.documentElement.appendChild(hostElement);
}

function updateIndicator(): void {
  if (!shadowRoot) return;

  // Remove existing indicator
  const existing = shadowRoot.querySelector('.indicator');
  existing?.remove();

  // Create new indicator
  const indicator = document.createElement('div');
  indicator.className = 'indicator';
  indicator.textContent = 'Phantom Mock Active'; // Safe — textContent, not innerHTML
  shadowRoot.appendChild(indicator);
}

// --- DOM Observation ---

let observer: MutationObserver | null = null;

function observeDOM(): void {
  observer = new MutationObserver((mutations) => {
    // Debounce — don't process every micro-change
    // Handle relevant mutations
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Process added/removed nodes
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: false, // Only direct children unless needed
  });
}

// --- Cleanup ---

function cleanup(): void {
  observer?.disconnect();
  observer = null;

  hostElement?.remove();
  hostElement = null;
  shadowRoot = null;

  chrome.runtime.onMessage.removeListener(handleMessage);
}

// --- Entry Point ---

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
