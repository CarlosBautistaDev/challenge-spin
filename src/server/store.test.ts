// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { WalletStore } from './store';
import type { TransferInput } from '@/lib/contracts';

let store: WalletStore;
let session: string;
const payment = (overrides: Partial<TransferInput> = {}): TransferInput => ({ amountCents: 125050, recipientId: 'ana', concept: 'Comida', idempotencyKey: crypto.randomUUID(), ...overrides });
beforeEach(() => { store = new WalletStore(); session = store.createSession('demo@spin.test'); });
describe('wallet service', () => {
  it('isolates wallets by session', async () => {
    const other = store.createSession('other@spin.test');
    await store.transfer(session, payment(), 'success');
    expect(store.wallet(other).balanceCents).toBe(2450000);
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('rejects missing or expired sessions', () => expect(() => store.wallet('missing')).toThrow('sesión'));
  it('does not expose mutable store data', () => {
    store.wallet(session).balanceCents = 0;
    expect(store.wallet(session).balanceCents).toBe(2450000);
  });
  it('persists and deduplicates normalized contacts', () => {
    const contact = store.addContact(session, { name: 'Luis', identity: '+52 55 1234 5678' });
    expect(store.wallet(session).contacts).toContainEqual(contact);
    expect(() => store.addContact(session, { name: 'Otro', identity: '5512345678' })).toThrow('existe');
  });
  it.each([0, -1, 1.1, 2450001])('rejects invalid or excessive amount %s on server', async amountCents => {
    await expect(store.transfer(session, payment({ amountCents }), 'success')).rejects.toThrow();
    expect(store.wallet(session).balanceCents).toBe(2450000);
  });
  it('requires a recipient from the session', async () => {
    await expect(store.transfer(session, payment({ recipientId: 'not-owned' }), 'success')).rejects.toThrow('destinatario');
  });
  it('allows spending the exact available balance', async () => {
    await store.transfer(session, payment({ amountCents: 2450000 }), 'success');
    expect(store.wallet(session).balanceCents).toBe(0);
  });
  it('reuses a receipt for duplicate submissions without a second debit', async () => {
    const input = payment();
    const receipts = await Promise.all([store.transfer(session, input, 'success'), store.transfer(session, input, 'success')]);
    expect(receipts[0].id).toBe(receipts[1].id);
    expect(store.wallet(session).balanceCents).toBe(2324950);
    expect(store.receipt(session, receipts[0].id)).toEqual(receipts[0]);
  });
  it('rejects reused key with a different payload', async () => {
    const input = payment();
    await store.transfer(session, input, 'success');
    await expect(store.transfer(session, { ...input, amountCents: 1 }, 'success')).rejects.toThrow('clave');
  });
  it('does not overdraw under simultaneous payments', async () => {
    const outcomes = await Promise.allSettled([store.transfer(session, payment({ amountCents: 2000000 }), 'success'), store.transfer(session, payment({ amountCents: 2000000 }), 'success')]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(store.wallet(session).balanceCents).toBe(450000);
  });
  it.each(['network', 'insufficient', 'unknown'] as const)('handles %s without debiting and allows retry', async scenario => {
    const input = payment();
    await expect(store.transfer(session, input, scenario)).rejects.toThrow();
    expect(store.wallet(session).balanceCents).toBe(2450000);
    await store.transfer(session, input, 'success');
    expect(store.wallet(session).balanceCents).toBe(2324950);
  });
  it('recovers a completed payment after a lost response using the same key', async () => {
    const input = payment();
    await expect(store.transfer(session, input, 'timeout')).rejects.toMatchObject({ code: 'TIMEOUT' });
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
