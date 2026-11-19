'use client';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeSessionInvalidation } from '@/lib/auth-events';
import { createTransferStore, isUncertain, type TransferStoreApi } from './transfer-store';

export const TransferContext = createContext<TransferStoreApi | null>(null);
export function TransferProvider({
  walletId,
  children,
}: {
  walletId: string;
  children: ReactNode;
}) {
  return (
    <WalletTransferProvider key={walletId} walletId={walletId}>
      {children}
    </WalletTransferProvider>
  );
}
function WalletTransferProvider({ walletId, children }: { walletId: string; children: ReactNode }) {
  const client = useQueryClient();
  const [runtime] = useState(() =>
    createTransferStore(
      walletId,
      (receipt) => {
        client.setQueryData(['receipt', walletId, receipt.id], receipt);
        void client.invalidateQueries({ queryKey: ['wallet', walletId] });
      },
      () => {
        void client.invalidateQueries({ queryKey: ['wallet', walletId] });
      },
    ),
  );
  useEffect(() => {
    const dispose = runtime.activate();
    // Invalidate synchronously, before React commits an auth-driven unmount.
    const unsubscribe = subscribeSessionInvalidation(dispose);
    const warn = (event: BeforeUnloadEvent) => {
      const { state } = runtime.store.getState();
      if (state.step !== 'submitting' && state.step !== 'verifying' && !isUncertain(state)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', warn);
      dispose();
    };
  }, [runtime]);
  return <TransferContext value={runtime.store}>{children}</TransferContext>;
}
