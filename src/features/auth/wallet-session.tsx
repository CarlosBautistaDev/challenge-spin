'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui';
import { clearPendingTransfers, subscribeSessionInvalidation } from '@/lib/auth-events';
import type { AppError } from '@/lib/errors';

type WalletSession = { walletId: string; user: { name: string; identity: string } };
const SessionContext = createContext<WalletSession | null>(null);

export function WalletSessionProvider({
  session,
  children,
}: {
  session: WalletSession;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [error, setError] = useState<AppError | null>(null);
  useEffect(
    () =>
      subscribeSessionInvalidation((reason) => {
        setError(reason);
        client.clear();
        clearPendingTransfers();
      }),
    [client],
  );
  if (error)
    return (
      <main className="main-content">
        <ErrorState error={error} />
      </main>
    );
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useWalletSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('WalletSessionProvider is required for wallet views.');
  return session;
}
