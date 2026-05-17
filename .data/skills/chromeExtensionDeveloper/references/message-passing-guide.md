# Message Passing Guide — phantom-mock

> Typed message schemas, routing patterns, port lifecycle, and error handling.

---

## Message Type System

All messages use a discriminated union pattern with a `type` field:

```typescript
// src/shared/messages.ts

export const MESSAGE_TYPES = {
  ADD_RULE: 'ADD_RULE',
  REMOVE_RULE: 'REMOVE_RULE',
  UPDATE_RULE: 'UPDATE_RULE',
  TOGGLE_RULE: 'TOGGLE_RULE',
  GET_RULES: 'GET_RULES',
  RULES_UPDATED: 'RULES_UPDATED',
  GET_STATUS: 'GET_STATUS',
  STATUS_RESPONSE: 'STATUS_RESPONSE',
} as const;

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

// Request messages (popup/content -> background)
export interface AddRuleMessage {
  type: typeof MESSAGE_TYPES.ADD_RULE;
  payload: {
    rule: MockRuleInput;
  };
}

export interface RemoveRuleMessage {
  type: typeof MESSAGE_TYPES.REMOVE_RULE;
  payload: {
    ruleId: number;
  };
}

export interface GetRulesMessage {
  type: typeof MESSAGE_TYPES.GET_RULES;
}

// Response type
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Union of all messages
export type ExtensionMessage =
  | AddRuleMessage
  | RemoveRuleMessage
  | UpdateRuleMessage
  | ToggleRuleMessage
  | GetRulesMessage
  | GetStatusMessage;
```

---

## Sending Messages (Popup -> Background)

```typescript
// src/shared/messages.ts — helper function

export async function sendMessage<T>(
  message: ExtensionMessage,
): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (chrome.runtime.lastError) {
      return { success: false, error: chrome.runtime.lastError.message };
    }
    return response as MessageResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Usage in popup
import { sendMessage, MESSAGE_TYPES } from '@/shared/messages';

const response = await sendMessage<MockRule[]>({
  type: MESSAGE_TYPES.GET_RULES,
});

if (response.success) {
  renderRules(response.data!);
} else {
  showError(response.error!);
}
```

---

## Receiving Messages (Background Service Worker)

```typescript
// src/background/index.ts

import { type ExtensionMessage, MESSAGE_TYPES } from '@/shared/messages';

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    // Type guard — reject unknown messages
    if (!message || !message.type || !(message.type in MESSAGE_TYPES)) {
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
    }

    // Async handler — return true to keep sendResponse alive
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Handler failed',
        });
      });

    return true; // Keep message channel open for async response
  },
);

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  switch (message.type) {
    case MESSAGE_TYPES.ADD_RULE:
      return handleAddRule(message.payload.rule);
    case MESSAGE_TYPES.REMOVE_RULE:
      return handleRemoveRule(message.payload.ruleId);
    case MESSAGE_TYPES.GET_RULES:
      return handleGetRules();
    default:
      return { success: false, error: `Unhandled message: ${message.type}` };
  }
}
```

---

## Content Script <-> Background Communication

```typescript
// src/content/index.ts — sending to background

async function notifyBackground(url: string): Promise<void> {
  const response = await sendMessage({
    type: MESSAGE_TYPES.GET_STATUS,
  });

  if (response.success && response.data?.active) {
    injectMockIndicator();
  }
}

// Background -> Content script (targeted)
async function notifyContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.RULES_UPDATED,
      payload: { rules: await getRules() },
    });
  } catch {
    // Tab might not have content script — ignore
  }
}
```

---

## Long-Lived Connections (Ports)

Use ports when real-time updates are needed (e.g., rule editing live preview):

```typescript
// Popup opens connection
const port = chrome.runtime.connect({ name: 'popup-live' });

port.onMessage.addListener((message: MessageResponse) => {
  updateUI(message.data);
});

port.onDisconnect.addListener(() => {
  // Cleanup — port closed (popup closed or SW terminated)
  console.log('Port disconnected');
});

// Background handles port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup-live') {
    port.onMessage.addListener((message) => {
      // Handle port messages
    });

    port.onDisconnect.addListener(() => {
      // Cleanup port-specific state
    });
  }
});
```

---

## Rules

1. **Always type messages** — never send untyped objects
2. **Always handle errors** — check `chrome.runtime.lastError` and catch exceptions
3. **Return `true` from `onMessage`** — when handler is async (keeps channel open)
4. **Validate incoming messages** — type guard before processing
5. **Never assume sender** — verify `sender.tab` or `sender.id` for security
6. **Handle disconnection** — ports close when popup closes or SW terminates
