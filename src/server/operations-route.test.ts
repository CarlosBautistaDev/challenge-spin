// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { operationResultSchema } from '@/lib/contracts';
import { GET } from '@/app/api/operations/[idempotencyKey]/route';
import { store } from './store';

let session: string;
let walletId: string;

beforeEach(() => {
  session = store.createSession('private@example.com');
  walletId = store.wallet(session).id;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => store.deleteSession(session));

function lookup(key: string, generation: string = walletId, cookie: string = session) {
  return GET(
    new NextRequest(`http://localhost/api/operations/${key}?walletId=${generation}`, {
      headers: cookie ? { cookie: `spin_session=${cookie}` } : {},
    }),
    { params: Promise.resolve({ idempotencyKey: key }) },
  );
}

describe('operation lookup boundary', () => {
  it('recovers the result of a lost confirmation without issuing another debit', async () => {
    const key = crypto.randomUUID();
    const input = {
      walletId,
      recipientId: 'ana',
      amountCents: 20000,
      concept: 'Comida',
      idempotencyKey: key,
    };
    await expect(store.transfer(session, input, 'timeout')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    const before = store.wallet(session);
    const response = await lookup(key);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const result = operationResultSchema.parse(await response.json());
    expect(result).toMatchObject({
      status: 'completed',
      receipt: { sender: { identity: 'private@example.com' } },
    });
    expect(store.wallet(session)).toEqual(before);
  });

  it('returns unknown for an unseen key without changing the wallet', async () => {
    const before = store.wallet(session);
    const response = await lookup(crypto.randomUUID());
    expect(response.status).toBe(200);
    expect(operationResultSchema.parse(await response.json())).toEqual({ status: 'unknown' });
    expect(store.wallet(session)).toEqual(before);
  });

  it('requires a session and its wallet generation', async () => {
    const key = crypto.randomUUID();
    expect((await lookup(key, walletId, '')).status).toBe(401);
    expect((await lookup(key, walletId, 'expired')).status).toBe(401);
    const mismatch = await lookup(key, crypto.randomUUID());
    expect(mismatch.status).toBe(409);
    expect(await mismatch.json()).toMatchObject({ error: { code: 'SESSION_CHANGED' } });
  });

  it.each([
    ['not-a-uuid', '00000000-0000-4000-8000-000000000001'],
    ['00000000-0000-4000-8000-000000000002', ''],
    ['00000000-0000-4000-8000-000000000002', 'private@example.com'],
  ])('rejects malformed operation or generation identifiers', async (key, generation) => {
    const response = await lookup(key, generation);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });
});
