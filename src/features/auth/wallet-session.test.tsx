import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { WalletSessionProvider } from './wallet-session';
import { invalidateClientSession } from '@/lib/auth-events';
import { AppError } from '@/lib/errors';

describe('wallet session boundary', () => {
  it('removes private views, cached results and pending payloads when authorization expires', () => {
    const client = new QueryClient();
    client.setQueryData(['receipt', 'expired-wallet', 'private-receipt'], { reference: 'private' });
    sessionStorage.setItem('spin-pending:v1:expired-wallet', 'private draft');
    render(
      <QueryClientProvider client={client}>
        <WalletSessionProvider
          session={{
            walletId: 'expired-wallet',
            user: { name: 'Alex', identity: 'demo@example.com' },
          }}
        >
          <p>Private wallet contents</p>
        </WalletSessionProvider>
      </QueryClientProvider>,
    );
    act(() => invalidateClientSession(new AppError('UNAUTHORIZED', 'Tu sesión terminó.', 401)));
    expect(screen.queryByText('Private wallet contents')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir al inicio de sesión/ })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(sessionStorage.getItem('spin-pending:v1:expired-wallet')).toBeNull();
  });
});
