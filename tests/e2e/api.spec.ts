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

test('concurrent HTTP payments cannot overdraw and a replay remains valid after the balance changes', async ({
  request,
}) => {
  await request.post('/api/session', { data: { identity: 'concurrency@example.com' } });
  const wallet = await (await request.get('/api/wallet')).json();
  const headers = { 'x-demo-scenario': 'success' };
  const inputs = [0, 1].map(() => ({
    walletId: wallet.id,
    amountCents: 2000000,
    recipientId: 'ana',
    concept: 'Concurrencia',
    idempotencyKey: crypto.randomUUID(),
  }));
  const responses = await Promise.all(
    inputs.map((data) => request.post('/api/transfers', { data, headers })),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 422]);
  const winner = responses.findIndex((r) => r.status() === 201);
  const receipt = await responses[winner].json();
  const replay = await request.post('/api/transfers', { data: inputs[winner], headers });
  expect(replay.status()).toBe(201);
  expect(await replay.json()).toEqual(receipt);
  expect(replay.headers()['x-request-id']).not.toBe(responses[winner].headers()['x-request-id']);
  const after = await (await request.get('/api/wallet')).json();
  expect(after.balanceCents).toBe(450000);
  expect(after.movements).toHaveLength(wallet.movements.length + 1);
});

test('concurrent identical requests produce one receipt and one debit', async ({ request }) => {
  await request.post('/api/session', { data: { identity: 'duplicates@example.com' } });
  const wallet = await (await request.get('/api/wallet')).json();
  const input = {
    walletId: wallet.id,
    amountCents: 10000,
    recipientId: 'ana',
    concept: '',
    idempotencyKey: crypto.randomUUID(),
  };
  const responses = await Promise.all(
    [0, 1].map(() =>
      request.post('/api/transfers', { data: input, headers: { 'x-demo-scenario': 'success' } }),
    ),
  );
  expect(responses.map((r) => r.status())).toEqual([201, 201]);
  expect(await responses[0].json()).toEqual(await responses[1].json());
  const after = await (await request.get('/api/wallet')).json();
  expect(after.balanceCents).toBe(2440000);
  expect(after.movements).toHaveLength(wallet.movements.length + 1);
});

test('operation lookup is read only, recovers a lost confirmation and isolates sessions', async ({
  request,
}) => {
  await request.post('/api/session', { data: { identity: 'lookup@example.com' } });
  const wallet = await (await request.get('/api/wallet')).json();
  const operationId = crypto.randomUUID();
  const url = `/api/operations/${operationId}?walletId=${wallet.id}`;
  expect(await (await request.get(url)).json()).toEqual({ status: 'unknown' });
  const timeout = await request.post('/api/transfers', {
    data: {
      walletId: wallet.id,
      amountCents: 125050,
      recipientId: 'ana',
      concept: 'Consulta',
      idempotencyKey: operationId,
    },
    headers: { 'x-demo-scenario': 'timeout' },
  });
  expect(timeout.status()).toBe(504);
  expect((await timeout.json()).error.requestId).toBe(timeout.headers()['x-request-id']);
  const committed = await (await request.get('/api/wallet')).json();
  const result = await (await request.get(url)).json();
  expect(result.status).toBe('completed');
  expect(result.receipt.sender.identity).toBe('lookup@example.com');
  expect(await (await request.get('/api/wallet')).json()).toEqual(committed);
  await request.post('/api/session', { data: { identity: 'other@example.com' } });
  expect((await request.get(url)).status()).toBe(409);
  const other = await (await request.get('/api/wallet')).json();
  expect(
    await (await request.get(`/api/operations/${operationId}?walletId=${other.id}`)).json(),
  ).toEqual({ status: 'unknown' });
});
