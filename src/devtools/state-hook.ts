import { useCallback, useEffect, useState } from 'react';
import { MESSAGE_TYPES } from '@/shared/constants';
import { sendMessage, type StateMutation } from '@/shared/messages';
import { isRuntimeMessage } from '@/shared/messages';
import type { AppState } from '@/shared/types';

export interface UseAppStateResult {
  state: AppState | null;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (mutation: StateMutation) => Promise<void>;
}

export function useAppState(): UseAppStateResult {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await sendMessage<{ ok: boolean; state?: AppState; error?: string }>({
        type: MESSAGE_TYPES.GET_STATE,
      });
      if (response.ok && response.state) {
        setState(response.state);
        setError(null);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const mutate = useCallback(async (mutation: StateMutation) => {
    try {
      const response = await sendMessage<{ ok: boolean; state?: AppState; error?: string }>({
        type: MESSAGE_TYPES.MUTATE_STATE,
        mutation,
      });
      if (response.ok && response.state) {
        setState(response.state);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // Initial pull of state from the service worker on mount, paired with the
    // subscription set up below. The setState happens inside `refresh`, which
    // is what react-hooks/set-state-in-effect flags — accepted here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const listener = (message: unknown): void => {
      if (!isRuntimeMessage(message)) return;
      if (message.type === MESSAGE_TYPES.RULES_UPDATED) {
        setState(message.state);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  return { state, error, refresh, mutate };
}
