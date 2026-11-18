'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeAuthChange } from '@/lib/auth-events';
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
        client.clear();
        router.replace('/login');
        router.refresh();
      }),
    [client, router],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
