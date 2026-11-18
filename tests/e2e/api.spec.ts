import { expect, test } from '@playwright/test';
test('API validates untrusted requests and protects session data', async ({ request }) => {
  expect((await request.get('/api/wallet')).status()).toBe(401);
  expect((await request.post('/api/session', { data: { identity: 'bad' } })).status()).toBe(400);
  expect(
    (await request.post('/api/session', { data: { identity: 'demo@example.com' } })).status(),
  ).toBe(201);
  const invalid = await request.post('/api/transfers', {
    data: { amountCents: -1, recipientId: 'ana', idempotencyKey: crypto.randomUUID() },
  });
  expect(invalid.status()).toBe(400);
  const malformed = await request.post('/api/transfers', {
    data: '{',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(malformed.status()).toBe(400);
  const currentWallet = await (await request.get('/api/wallet')).json();
  const input = {
    walletId: currentWallet.id,
    amountCents: 100,
    recipientId: 'ana',
    idempotencyKey: crypto.randomUUID(),
    concept: 'Prueba',
  };
  const headers = { 'x-demo-scenario': 'success' };
  const a = await request.post('/api/transfers', { data: input, headers });
  const b = await request.post('/api/transfers', { data: input, headers });
  expect(a.status()).toBe(201);
  expect(await b.json()).toEqual(await a.json());
  const wallet = await (await request.get('/api/wallet')).json();
  expect(wallet.balanceCents).toBe(2449900);
  expect(
    (
      await request.post('/api/transfers', { data: { ...input, amountCents: 200 }, headers })
    ).status(),
  ).toBe(409);
  await request.delete('/api/session');
  expect((await request.get('/api/wallet')).status()).toBe(401);
});

test('API rejects a payment reviewed before the session changed', async ({ request }) => {
  await request.post('/api/session', { data: { identity: 'first@example.com' } });
  const first = await (await request.get('/api/wallet')).json();
  await request.post('/api/session', { data: { identity: 'second@example.com' } });
  const response = await request.post('/api/transfers', {
    data: {
      walletId: first.id,
      amountCents: 100,
      recipientId: 'ana',
      concept: '',
      idempotencyKey: crypto.randomUUID(),
    },
    headers: { 'x-demo-scenario': 'success' },
  });
  expect(response.status()).toBe(409);
  expect((await response.json()).error.code).toBe('SESSION_CHANGED');
  expect((await (await request.get('/api/wallet')).json()).balanceCents).toBe(2450000);
});
