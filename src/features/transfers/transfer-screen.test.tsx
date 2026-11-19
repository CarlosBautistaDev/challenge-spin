import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletSessionProvider } from '@/features/auth/wallet-session';
import { TransferProvider } from './transfer-provider';
import { TransferScreen } from './transfer-screen';
import type { Wallet } from '@/lib/contracts';
const navigation = vi.hoisted(() => ({
  pathname: '/transfer',
  replace: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));
const wallet: Wallet = {
  id: '00000000-0000-4000-8000-000000000001',
  user: { name: 'Carlos', identity: '5512345678' },
  balanceCents: 100000,
  contacts: [{ id: 'ana', name: 'Ana López', identity: '5510102030' }],
  movements: [],
};
const json = (data: unknown) => new Response(JSON.stringify(data));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['wallet', wallet.id, 'normal'], wallet);
  render(
    <QueryClientProvider client={client}>
      <WalletSessionProvider session={{ walletId: wallet.id, user: wallet.user }}>
        <TransferProvider walletId={wallet.id}>
          <TransferScreen />
        </TransferProvider>
      </WalletSessionProvider>
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}
beforeEach(() => {
  sessionStorage.clear();
  navigation.pathname = '/transfer';
  navigation.params = new URLSearchParams();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json(wallet)),
  );
});
describe('transfer screen', () => {
  it('keeps the draft and form visible after a background wallet failure', async () => {
    const { user, client } = setup();
    const amount = await screen.findByLabelText('¿Cuánto quieres enviar?');
    await user.type(amount, '12.50');
    vi.mocked(fetch).mockRejectedValue(new TypeError('Offline'));
    await act(() => client.invalidateQueries({ queryKey: ['wallet', wallet.id] }));
    await screen.findByRole('status');
    expect(screen.getByLabelText('¿Cuánto quieres enviar?')).toHaveValue('12.50');
  });
  it('returns focus to the amount when editing reviewed details', async () => {
    const { user } = setup();
    await user.click(await screen.findByLabelText(/Ana López/));
    await user.type(screen.getByLabelText('¿Cuánto quieres enviar?'), '12.50');
    await user.click(screen.getByRole('button', { name: 'Revisar envío' }));
    await user.click(screen.getByRole('button', { name: 'Editar datos' }));
    expect(screen.getByLabelText('¿Cuánto quieres enviar?')).toHaveFocus();
    expect(screen.getByLabelText('¿Cuánto quieres enviar?')).toHaveValue('12.50');
  });
  it('returns focus to the new-contact trigger on cancellation', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Nuevo contacto' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Nuevo contacto' })).toHaveFocus();
  });
  it('selects and focuses a newly saved recipient', async () => {
    const { user } = setup();
    const contact = { id: 'maria', name: 'María Torres', identity: '5512345679' };
    await user.click(await screen.findByRole('button', { name: 'Nuevo contacto' }));
    await user.type(screen.getByLabelText('Nombre del contacto'), contact.name);
    await user.type(screen.getByLabelText('Teléfono o correo del contacto'), contact.identity);
    vi.mocked(fetch).mockImplementation(async (url) =>
      json(
        String(url) === '/api/contacts'
          ? contact
          : { ...wallet, contacts: [...wallet.contacts, contact] },
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Guardar contacto' }));
    await waitFor(() => expect(screen.getByLabelText(/María Torres/)).toBeChecked());
    expect(screen.getByLabelText(/María Torres/)).toHaveFocus();
  });
});
