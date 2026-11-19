import { AppError } from './errors';

const CHANNEL = 'spin-auth';
const INVALIDATED = 'spin-session-invalidated';
let tabId: string | undefined;
const currentTabId = () => (tabId ??= crypto.randomUUID());
export function announceAuthChange() {
  // Only a signal crosses tabs. No cookie, identity or financial data is broadcast.
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ sender: currentTabId() });
    channel.close();
  }
}
export function subscribeAuthChange(listener: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ownId = currentTabId();
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data === 'object' && data !== null && 'sender' in data && data.sender !== ownId)
      listener();
  };
  return () => channel.close();
}

export function clearPendingTransfers() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('spin-pending:')) sessionStorage.removeItem(key);
    }
  } catch {
    // Browsers may deny storage access. The API still enforces the wallet generation.
  }
}

export function invalidateClientSession(error: AppError) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVALIDATED, { detail: error }));
  }
}

export function subscribeSessionInvalidation(listener: (error: AppError) => void) {
  const onInvalidated = (event: Event) => {
    if (event instanceof CustomEvent && event.detail instanceof AppError) listener(event.detail);
  };
  window.addEventListener(INVALIDATED, onInvalidated);
  return () => window.removeEventListener(INVALIDATED, onInvalidated);
}
