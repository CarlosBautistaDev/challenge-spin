// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { WalletStore } from './store';
import type { TransferInput } from '@/lib/contracts';

let store: WalletStore;
let session: string;
const payment = (overrides: Partial<TransferInput> = {}): TransferInput => ({
  walletId: store.wallet(session).id,
  amountCents: 125050,
  recipientId: 'ana',
  concept: 'Comida',
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
beforeEach(() => {
  store = new WalletStore();
  session = store.createSession('demo@spin.test');
});
describe('wallet service', () => {
  it('rejects a payment reviewed under another session generation', async () => {
    const other = store.createSession('other@spin.test');
    await expect(
      store.transfer(
        other,
        { ...payment(), walletId: '00000000-0000-4000-8000-000000000001' },
        'success',
      ),
    ).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(store.wallet(other).balanceCents).toBe(2450000);
  });
  it('isolates wallets by session', async () => {
    const other = store.createSession('other@spin.test');
    await store.transfer(session, payment(), 'success');
    expect(store.wallet(other).balanceCents).toBe(2450000);
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('rejects missing or expired sessions', () =>
    expect(() => store.wallet('missing')).toThrow('sesión'));
  it('does not expose mutable store data', () => {
    store.wallet(session).balanceCents = 0;
    expect(store.wallet(session).balanceCents).toBe(2450000);
  });
  it('persists and deduplicates normalized contacts', () => {
    const contact = store.addContact(
      session,
      { name: 'Luis', identity: '+52 55 1234 5678' },
      store.wallet(session).id,
    );
    expect(store.wallet(session).contacts).toContainEqual(contact);
    expect(() =>
      store.addContact(session, { name: 'Otro', identity: '5512345678' }, store.wallet(session).id),
    ).toThrow('existe');
  });
  it.each([0, -1, 1.1, 2450001])(
    'rejects invalid or excessive amount %s on server',
    async (amountCents) => {
      await expect(store.transfer(session, payment({ amountCents }), 'success')).rejects.toThrow();
      expect(store.wallet(session).balanceCents).toBe(2450000);
    },
  );
  it('requires a recipient from the session', async () => {
    await expect(
      store.transfer(session, payment({ recipientId: 'not-owned' }), 'success'),
    ).rejects.toThrow('destinatario');
  });
  it('allows spending the exact available balance', async () => {
    await store.transfer(session, payment({ amountCents: 2450000 }), 'success');
    expect(store.wallet(session).balanceCents).toBe(0);
  });
  it('reuses a receipt for duplicate submissions without a second debit', async () => {
    const input = payment();
    const receipts = await Promise.all([
      store.transfer(session, input, 'success'),
      store.transfer(session, input, 'success'),
    ]);
    expect(receipts[0].id).toBe(receipts[1].id);
    expect(store.wallet(session).balanceCents).toBe(2324950);
    expect(store.receipt(session, receipts[0].id)).toEqual(receipts[0]);
  });
  it('keeps the sender snapshot on the stored receipt', async () => {
    const receipt = await store.transfer(session, payment(), 'success');
    expect(receipt.sender).toEqual({ name: 'Alex Morgan', identity: 'demo@spin.test' });
    receipt.sender.name = 'Changed in the client';
    expect(store.receipt(session, receipt.id).sender.name).toBe('Alex Morgan');
  });
  it('looks up unknown and completed operations without changing the wallet', async () => {
    const input = payment();
    const before = store.wallet(session);
    expect(store.operation(session, input.idempotencyKey, input.walletId)).toEqual({
      status: 'unknown',
    });
    expect(store.wallet(session)).toEqual(before);
    await expect(store.transfer(session, input, 'timeout')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    const after = store.wallet(session);
    const result = store.operation(session, input.idempotencyKey, input.walletId);
    expect(result).toMatchObject({ status: 'completed', receipt: { amountCents: 125050 } });
    expect(store.wallet(session)).toEqual(after);
    if (result.status === 'completed') result.receipt.concept = 'Changed';
    expect(store.operation(session, input.idempotencyKey, input.walletId)).toMatchObject({
      receipt: { concept: 'Comida' },
    });
  });
  it('isolates operation lookups and verifies the wallet generation', async () => {
    const input = payment();
    await store.transfer(session, input, 'success');
    const other = store.createSession('other@example.com');
    expect(store.operation(other, input.idempotencyKey, store.wallet(other).id)).toEqual({
      status: 'unknown',
    });
    expect(() => store.operation(other, input.idempotencyKey, input.walletId)).toThrow(
      'sesión cambió',
    );
    expect(() => store.operation('missing', input.idempotencyKey, input.walletId)).toThrow(
      'sesión',
    );
  });
  it('reports one commit and a replay even when the first confirmation times out', async () => {
    const input = payment();
    const events: { event: string; operationId: string }[] = [];
    const observe = (event: string, operationId: string) => events.push({ event, operationId });
    await expect(store.transfer(session, input, 'timeout', observe)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    await store.transfer(session, input, 'success', observe);
    expect(events).toEqual([
      { event: 'transfer.committed', operationId: input.idempotencyKey },
      { event: 'transfer.replayed', operationId: input.idempotencyKey },
    ]);
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('does not turn a committed payment into a failure if its observer fails', async () => {
    const input = payment();
    const receipt = await store.transfer(session, input, 'success', () => {
      throw new Error('log sink unavailable');
    });
    expect(receipt.status).toBe('completed');
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('rejects reused key with a different payload', async () => {
    const input = payment();
    await store.transfer(session, input, 'success');
    await expect(store.transfer(session, { ...input, amountCents: 1 }, 'success')).rejects.toThrow(
      'clave',
    );
  });
  it('does not overdraw under simultaneous payments', async () => {
    const outcomes = await Promise.allSettled([
      store.transfer(session, payment({ amountCents: 2000000 }), 'success'),
      store.transfer(session, payment({ amountCents: 2000000 }), 'success'),
    ]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(store.wallet(session).balanceCents).toBe(450000);
  });
  it.each(['network', 'insufficient', 'unknown'] as const)(
    'handles %s without debiting and allows retry',
    async (scenario) => {
      const input = payment();
      await expect(store.transfer(session, input, scenario)).rejects.toThrow();
      expect(store.wallet(session).balanceCents).toBe(2450000);
      await store.transfer(session, input, 'success');
      expect(store.wallet(session).balanceCents).toBe(2324950);
    },
  );
  it('recovers a completed payment after a lost response using the same key', async () => {
    const input = payment();
    await expect(store.transfer(session, input, 'timeout')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    const receipt = await store.transfer(session, input, 'success');
    expect(receipt.status).toBe('completed');
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('does not expose another session receipt', async () => {
    const receipt = await store.transfer(session, payment(), 'success');
    const other = store.createSession('other@example.com');
    expect(() => store.receipt(other, receipt.id)).toThrow('comprobante');
  });
  it('revokes sessions on logout', () => {
    store.deleteSession(session);
    expect(() => store.wallet(session)).toThrow('sesión');
  });
});

describe('random scenarios', () => {
  it.each([
    [0.1, 'success'],
    [0.65, 'NETWORK'],
    [0.75, 'INSUFFICIENT_FUNDS'],
    [0.85, 'TIMEOUT'],
    [0.95, 'UNKNOWN'],
  ] as const)('maps random %s to %s', async (random, expected) => {
    const service = new WalletStore(() => random);
    const id = service.createSession('demo@example.com');
    const input = { ...payment(), walletId: service.wallet(id).id };
    if (expected === 'success')
      expect((await service.transfer(id, input)).status).toBe('completed');
    else await expect(service.transfer(id, input)).rejects.toMatchObject({ code: expected });
  });
});
