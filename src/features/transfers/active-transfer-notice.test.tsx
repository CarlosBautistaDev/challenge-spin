import { type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferProvider } from './transfer-provider';
import { useTransfer } from './use-transfer';
import { ActiveTransferNotice } from './active-transfer-notice';
import { TransferScreen } from './transfer-screen';
import { WalletSessionProvider } from '@/features/auth/wallet-session';
import type { Receipt, Wallet } from '@/lib/contracts';
const navigation = vi.hoisted(() => ({ pathname: '/home', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
const wallet: Wallet = {
  id: '00000000-0000-4000-8000-000000000001',
  user: { name: 'Carlos', identity: '5512345678' },
  balanceCents: 1000,
  contacts: [{ id: 'ana', name: 'Ana López', identity: '5510102030' }],
  movements: [],
};
const receipt: Receipt = {
  id: 'receipt-1',
  amountCents: 100,
  recipient: wallet.contacts[0],
  sender: wallet.user,
  concept: '',
  createdAt: '2026-11-19T16:00:00.000Z',
  reference: 'REF',
  status: 'completed',
};
const json = (value: unknown) => new Response(JSON.stringify(value));
beforeEach(() => {
  sessionStorage.clear();
  navigation.pathname = '/home';
  navigation.replace.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json(receipt)),
  );
});
function setup(showScreen = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['wallet', wallet.id, 'normal'], wallet);
  let transfer!: ReturnType<typeof useTransfer>;
  function Consumer() {
    transfer = useTransfer();
    return null;
  }
  function Tree({ children }: { children?: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <WalletSessionProvider session={{ walletId: wallet.id, user: wallet.user }}>
          <TransferProvider walletId={wallet.id}>
            <Consumer />
            <ActiveTransferNotice />
            {children}
          </TransferProvider>
        </WalletSessionProvider>
      </QueryClientProvider>
    );
  }
  const view = render(<Tree>{showScreen && <TransferScreen />}</Tree>);
  return {
    get transfer() {
      return transfer;
    },
    view,
    Tree,
  };
}
describe('active transfer notice', () => {
  it('offers draft resumption from another route', () => {
    const app = setup();
    act(() => app.transfer.updateDraft({ amount: '12.50' }));
    expect(screen.getByRole('link', { name: 'Continuar envío' })).toHaveAttribute(
      'href',
      '/transfer',
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it('starts another transfer from the completion notice', async () => {
    const app = setup();
    act(() =>
      app.transfer.review({
        walletId: wallet.id,
        amountCents: 100,
        recipientId: 'ana',
        concept: '',
      }),
    );
    await act(() => app.transfer.confirm('success'));
    expect(screen.getByRole('link', { name: 'Ver comprobante' })).toHaveAttribute(
      'href',
      '/receipt/receipt-1',
    );
    const start = screen.getByRole('link', { name: 'Hacer otro envío' });
    expect(start).toHaveAttribute('href', '/transfer');
    // JSDOM has no document navigation; the browser suite covers the actual route change.
    start.addEventListener('click', (event) => event.preventDefault());
    await userEvent.setup().click(start);
    expect(app.transfer.state.step).toBe('editing');
  });
  it('shows completion after leaving the transfer route without redirecting', async () => {
    navigation.pathname = '/transfer';
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.mocked(fetch).mockImplementation((url) =>
      String(url) === '/api/transfers' ? pending : Promise.resolve(json(wallet)),
    );
    const app = setup(true);
    act(() =>
      app.transfer.review({
        walletId: wallet.id,
        amountCents: 100,
        recipientId: 'ana',
        concept: '',
      }),
    );
    let request!: Promise<void>;
    act(() => {
      request = app.transfer.confirm('success');
    });
    navigation.pathname = '/home';
    app.view.rerender(
      <app.Tree>
        <h1>Home</h1>
      </app.Tree>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Tu envío está en proceso.');
    await act(async () => {
      finish(json(receipt));
      await request;
    });
    expect(screen.getByRole('link', { name: 'Ver comprobante' })).toHaveAttribute(
      'href',
      '/receipt/receipt-1',
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
