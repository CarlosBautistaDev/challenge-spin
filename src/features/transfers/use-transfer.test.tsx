import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTransfer } from './use-transfer';
import { AppError } from '@/lib/errors';
import type { Receipt, TransferInput } from '@/lib/contracts';

const receipt: Receipt = { id: 'receipt-1', amountCents: 100, recipient: { id: 'ana', name: 'Ana', identity: '5510102030' }, concept: '', createdAt: new Date().toISOString(), reference: 'REF', status: 'completed' };
describe('transfer lifecycle', () => {
  it('preserves the idempotency key on retry after timeout', async () => {
    const calls: TransferInput[] = [];
    const send = async (input: TransferInput) => {
      calls.push(input);
      if (calls.length === 1) throw new AppError('TIMEOUT', 'Tiempo agotado');
      return receipt;
    };
    const { result } = renderHook(() => useTransfer(send));
    act(() => result.current.review({ amountCents: 100, recipientId: 'ana', concept: '' }));
    expect(result.current.state.step).toBe('review');
    await act(() => result.current.confirm('success'));
    expect(result.current.state.step).toBe('error');
    await act(() => result.current.confirm('success'));
    expect(result.current.state.step).toBe('success');
    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toBe(calls[1].idempotencyKey);
  });
  it('blocks duplicate submissions while a request is pending', async () => {
    let finish!: (value: Receipt) => void;
    const send = vi.fn(() => new Promise<Receipt>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useTransfer(send));
    act(() => result.current.review({ amountCents: 100, recipientId: 'ana', concept: '' }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.confirm('success'); void result.current.confirm('success'); });
    expect(result.current.state.step).toBe('submitting');
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { finish(receipt); await pending; });
    expect(result.current.state.step).toBe('success');
  });
  it('does not allow editing an operation with an uncertain outcome', async () => {
    const { result } = renderHook(() => useTransfer(async () => { throw new AppError('TIMEOUT', 'Tiempo agotado'); }));
    act(() => result.current.review({ amountCents: 100, recipientId: 'ana', concept: '' }));
    await act(() => result.current.confirm('success'));
    act(() => result.current.edit());
    expect(result.current.state.step).toBe('error');
  });
});
