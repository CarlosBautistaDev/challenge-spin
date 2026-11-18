const CHANNEL = 'spin-auth';
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
