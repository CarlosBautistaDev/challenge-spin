import { StrictMode, type ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransfer } from './use-transfer';
import { TransferProvider } from './transfer-provider';
import { WalletSessionProvider } from '@/features/auth/wallet-session';
import type { Receipt, TransferInput } from '@/lib/contracts';

const walletId = '00000000-0000-4000-8000-000000000001';
const otherWalletId = '00000000-0000-4000-8000-000000000002';
const receipt: Receipt = {
  id: 'receipt-1',
  amountCents: 100,
  sender: { name: 'Carlos', identity: '5512345678' },
  recipient: { id: 'ana', name: 'Ana', identity: '5510102030' },
  concept: '',
  createdAt: '2026-11-19T16:00:00.000Z',
  reference: 'REF',
  status: 'completed',
};
const input = { walletId, amountCents: 100, recipientId: 'ana', concept: '' };
const pendingKey = `spin-pending:v1:${walletId}`;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function setup(strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    const content = (
      <QueryClientProvider client={client}>
        <TransferProvider walletId={walletId}>{children}</TransferProvider>
      </QueryClientProvider>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  }
  return { client, wrapper: Wrapper };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

describe('transfer lifecycle', () => {
  it('shares the reviewed operation with another consumer in the same provider', () => {
    const { result } = renderHook(() => ({ form: useTransfer(), notice: useTransfer() }), setup());
    act(() => result.current.form.review(input));
    expect(result.current.notice.state.step).toBe('review');
  });

  it('isolates independent provider trees even for the same wallet', () => {
    const first = renderHook(() => useTransfer(), setup());
    const second = renderHook(() => useTransfer(), setup());
    act(() => {
      first.result.current.updateDraft({ amount: '12.50', recipientId: 'ana', concept: 'Cena' });
      first.result.current.review(input);
    });
    expect(second.result.current.state.step).toBe('editing');
    expect(second.result.current.draft).toEqual({ amount: '', recipientId: '', concept: '' });
  });

  it('keeps exact draft text when the route consumer unmounts', () => {
    let transfer!: ReturnType<typeof useTransfer>;
    function Form() {
      transfer = useTransfer();
      return <output>{JSON.stringify(transfer.draft)}</output>;
    }
    const { wrapper: Wrapper } = setup();
    const view = render(
      <Wrapper>
        <Form />
      </Wrapper>,
    );
    act(() => transfer.updateDraft({ amount: '0012.50', recipientId: 'ana', concept: 'Cena ' }));
    view.rerender(
      <Wrapper>
        <p>Home</p>
      </Wrapper>,
    );
    view.rerender(
      <Wrapper>
        <Form />
      </Wrapper>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('0012.50');
    expect(transfer.draft).toEqual({ amount: '0012.50', recipientId: 'ana', concept: 'Cena ' });
    expect(sessionStorage.length).toBe(0);
  });

  it('freezes the reviewed intent and preserves the draft for editing', () => {
    const { result } = renderHook(() => useTransfer(), setup());
    const mutable = { ...input };
    act(() => {
      result.current.updateDraft({ amount: '1.00', recipientId: 'ana', concept: 'Cena' });
      result.current.review(mutable);
    });
    mutable.amountCents = 900;
    act(() => result.current.updateDraft({ amount: '9.00' }));
    expect(result.current.state).toMatchObject({ step: 'review', input: { amountCents: 100 } });
    expect(result.current.draft.amount).toBe('1.00');
    expect(sessionStorage.length).toBe(0);
    act(() => result.current.edit());
    expect(result.current.state.step).toBe('editing');
    expect(result.current.draft.amount).toBe('1.00');
  });

  it('blocks same-tick duplicate sends and caches the receipt outside the local store', async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValue(pending.promise);
    const options = setup();
    options.client.setQueryData(['wallet', walletId, 'normal'], { balanceCents: 1000 });
    const { result } = renderHook(() => ({ form: useTransfer(), notice: useTransfer() }), options);
    act(() => result.current.form.review(input));
    let request!: Promise<void>;
    act(() => {
      request = result.current.form.confirm('success');
      void result.current.notice.confirm('success');
    });
    expect(result.current.notice.state.step).toBe('submitting');
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(json(receipt));
      await request;
    });
    expect(result.current.form.state).toEqual({ step: 'success', receiptId: receipt.id });
    expect(options.client.getQueryData(['receipt', walletId, receipt.id])).toEqual(receipt);
    expect(options.client.getQueryState(['wallet', walletId, 'normal'])?.isInvalidated).toBe(true);
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('recovers an unresolved intent after remount and verifies with a read-only request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      json({ error: { code: 'TIMEOUT', message: 'Tiempo agotado' } }, 504),
    );
    const first = renderHook(() => useTransfer(), setup());
    act(() => first.result.current.review(input));
    await act(() => first.result.current.confirm('timeout'));
    const original = JSON.parse(sessionStorage.getItem(pendingKey)!);
    first.unmount();
    const options = setup(true);
    const second = renderHook(() => useTransfer(), options);
    expect(second.result.current.state).toMatchObject({ step: 'error', input: original.input });
    vi.mocked(fetch).mockResolvedValueOnce(json({ status: 'completed', receipt }));
    await act(() => second.result.current.verify());
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/operations/${original.input.idempotencyKey}?walletId=${walletId}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(second.result.current.state).toEqual({ step: 'success', receiptId: receipt.id });
    expect(options.client.getQueryData(['receipt', walletId, receipt.id])).toEqual(receipt);
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('leaves unknown verification unresolved and retries only the original intent', async () => {
    const requests: { url: string; body?: TransferInput }[] = [];
    vi.mocked(fetch).mockImplementation(async (url, options) => {
      requests.push({
        url: String(url),
        body: options?.body ? JSON.parse(String(options.body)) : undefined,
      });
      if (requests.length === 1) throw new TypeError('Connection lost');
      if (requests.length === 2) return json({ status: 'unknown' });
      return json(receipt);
    });
    const { result } = renderHook(() => useTransfer(), setup());
    act(() => result.current.review(input));
    await act(() => result.current.confirm('network'));
    act(() => result.current.edit());
    expect(result.current.state.step).toBe('error');
    await act(() => result.current.verify());
    expect(result.current.state).toMatchObject({ step: 'error', lookup: 'unknown' });
    expect(requests).toHaveLength(2);
    expect(sessionStorage.getItem(pendingKey)).not.toBeNull();
    await act(() => result.current.confirm('success'));
    expect(requests[2].body).toEqual(requests[0].body);
    expect(result.current.state.step).toBe('success');
  });

  it('ignores a late response after provider disposal without deleting recoverable storage', async () => {
    const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValue(pending.promise);
    const options = setup();
    const { result, unmount } = renderHook(() => useTransfer(), options);
    act(() => result.current.review(input));
    let request!: Promise<void>;
    act(() => {
      request = result.current.confirm('success');
    });
    const saved = sessionStorage.getItem(pendingKey);
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      pending.resolve(json(receipt));
      await request;
    });
    expect(options.client.getQueryData(['receipt', walletId, receipt.id])).toBeUndefined();
    expect(sessionStorage.getItem(pendingKey)).toBe(saved);
  });

  it('starts with an empty store when the provider wallet changes', () => {
    const client = new QueryClient();
    let transfer!: ReturnType<typeof useTransfer>;
    function Consumer() {
      transfer = useTransfer();
      return null;
    }
    function Tree({ id }: { id: string }) {
      return (
        <QueryClientProvider client={client}>
          <TransferProvider walletId={id}>
            <Consumer />
          </TransferProvider>
        </QueryClientProvider>
      );
    }
    const view = render(<Tree id={walletId} />);
    act(() => transfer.updateDraft({ amount: '100', recipientId: 'ana' }));
    view.rerender(<Tree id={otherWalletId} />);
    expect(transfer.draft).toEqual({ amount: '', recipientId: '', concept: '' });
    act(() => transfer.review(input));
    expect(transfer.state.step).toBe('editing');
  });

  it('ignores persisted intent from another wallet', () => {
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({
        version: 1,
        walletId,
        input: { ...input, walletId: otherWalletId, idempotencyKey: crypto.randomUUID() },
      }),
    );
    const { result } = renderHook(() => useTransfer(), setup());
    expect(result.current.state.step).toBe('editing');
  });

  it('blocks editing and sending after session expiry', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ error: { code: 'SESSION_CHANGED', message: 'Vuelve a entrar' } }, 409),
    );
    let flow!: ReturnType<typeof useTransfer>;
    function Consumer() {
      flow = useTransfer();
      return <p>Private transfer</p>;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WalletSessionProvider session={{ walletId, user: receipt.sender }}>
          <TransferProvider walletId={walletId}>
            <Consumer />
          </TransferProvider>
        </WalletSessionProvider>
      </QueryClientProvider>,
    );
    act(() => flow.review(input));
    await act(() => flow.confirm('success'));
    act(() => flow.edit());
    await act(() => flow.confirm('success'));
    await act(() => flow.verify());
    expect(screen.queryByText('Private transfer')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir al inicio de sesión/ })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });
});
