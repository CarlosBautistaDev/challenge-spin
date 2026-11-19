'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  subscribeAuthChange,
  clearPendingTransfers,
  invalidateClientSession,
} from '@/lib/auth-events';
import { AppError } from '@/lib/errors';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  const router = useRouter();
  useEffect(
    () =>
      subscribeAuthChange(() => {
        invalidateClientSession(
          new AppError('SESSION_CHANGED', 'La sesión cambió. Vuelve a entrar.', 409),
        );
        client.clear();
        clearPendingTransfers();
        router.replace('/login');
        router.refresh();
      }),
    [client, router],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
