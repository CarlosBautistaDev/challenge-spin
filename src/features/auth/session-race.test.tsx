import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { WalletSessionProvider } from '@/features/auth/wallet-session';
import { TransferProvider } from '@/features/transfers/transfer-provider';
import { useTransfer } from '@/features/transfers/use-transfer';
import { invalidateClientSession } from '@/lib/auth-events';
import { AppError } from '@/lib/errors';
it('does not refill a cleared cache when a sent operation settles in the invalidation batch', async () => {
  const walletId = '00000000-0000-4000-8000-000000000001';
  const receipt = {
    id: 'receipt',
    amountCents: 100,
    sender: { name: 'private', identity: 'private@example.com' },
    recipient: { id: 'ana', name: 'Ana', identity: '5510102030' },
    concept: '',
    createdAt: '2026-11-19T16:00:00.000Z',
    reference: 'REF',
    status: 'completed',
  };
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>((done) => {
    resolve = done;
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => pending);
  const client = new QueryClient();
  let transfer!: ReturnType<typeof useTransfer>;
  function Consumer() {
    transfer = useTransfer();
    return <p>Private view</p>;
  }
  render(
    <QueryClientProvider client={client}>
      <WalletSessionProvider session={{ walletId, user: receipt.sender }}>
        <TransferProvider walletId={walletId}>
          <Consumer />
        </TransferProvider>
      </WalletSessionProvider>
    </QueryClientProvider>,
  );
  act(() => transfer.review({ walletId, amountCents: 100, recipientId: 'ana', concept: '' }));
  let request!: Promise<void>;
  act(() => {
    request = transfer.confirm('success');
  });
  await act(async () => {
    invalidateClientSession(new AppError('UNAUTHORIZED', 'Expired', 401));
    resolve(Response.json(receipt));
    await request;
  });
  expect(screen.queryByText('Private view')).toBeNull();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
