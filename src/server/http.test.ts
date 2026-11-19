// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { demoScenario, handle, json } from './http';
import { WalletStore } from './store';

afterEach(() => vi.unstubAllEnvs());

describe('request diagnostics', () => {
  it('returns distinct references and correlates failed attempts with business outcomes', async () => {
    vi.stubEnv('APP_ENV', 'uat');
    vi.stubEnv('APP_VERSION', 'challenge-2');
    const events: unknown[] = [];
    const sink = (event: unknown) => events.push(event);
    const service = new WalletStore();
    const session = service.createSession('private@example.com');
    const input = {
      walletId: service.wallet(session).id,
      recipientId: 'ana',
      amountCents: 125050,
      concept: 'PRIVATE-CONCEPT',
      idempotencyKey: crypto.randomUUID(),
    };
    const request = () =>
      new Request('http://localhost/api/transfers?email=private@example.com', {
        method: 'POST',
        headers: { cookie: `spin_session=${session}`, 'x-request-id': 'untrusted-reference' },
      });
    const first = await handle(
      request(),
      async (context) => {
        context.setOperationId(input.idempotencyKey);
        return json(
          await service.transfer(session, input, 'timeout', context.observeTransfer),
          201,
        );
      },
      sink,
    );
    const second = await handle(
      request(),
      async (context) => {
        context.setOperationId(input.idempotencyKey);
        return json(
          await service.transfer(session, input, 'success', context.observeTransfer),
          201,
        );
      },
      sink,
    );
    const firstId = first.headers.get('x-request-id');
    const secondId = second.headers.get('x-request-id');
    expect(z.uuid().safeParse(firstId).success).toBe(true);
    expect(firstId).not.toBe(secondId);
    expect(first.status).toBe(504);
    expect(await first.json()).toMatchObject({ error: { code: 'TIMEOUT', requestId: firstId } });
    expect(second.status).toBe(201);
    expect(events).toEqual([
      expect.objectContaining({
        event: 'transfer.committed',
        requestId: firstId,
        operationId: input.idempotencyKey,
      }),
      expect.objectContaining({
        event: 'request.finished',
        requestId: firstId,
        httpStatus: 504,
        errorCode: 'TIMEOUT',
      }),
      expect.objectContaining({
        event: 'transfer.replayed',
        requestId: secondId,
        operationId: input.idempotencyKey,
      }),
      expect.objectContaining({ event: 'request.finished', requestId: secondId, httpStatus: 201 }),
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        route: '/api/transfers',
        method: 'POST',
        environment: 'uat',
        appVersion: 'challenge-2',
        simulation: true,
      });
    }
    const serialized = JSON.stringify(events);
    for (const privateValue of [
      'private@example.com',
      'PRIVATE-CONCEPT',
      '125050',
      session,
      input.walletId,
      'Ana López',
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it.each([
    new AppError('VALIDATION', 'Invalid JSON'),
    new AppError('UNAUTHORIZED', 'Expired', 401),
    new Error('private internal error'),
  ])(
    'assigns a reference before validation, authentication or unexpected failure',
    async (error) => {
      const events: unknown[] = [];
      const response = await handle(
        new Request('http://localhost/api/operations/not-an-id?walletId=secret'),
        () => {
          throw error;
        },
        (event) => events.push(event),
      );
      const requestId = response.headers.get('x-request-id');
      expect(z.uuid().safeParse(requestId).success).toBe(true);
      expect(await response.json()).toMatchObject({ error: { requestId } });
      expect(events).toEqual([
        expect.objectContaining({
          event: 'request.finished',
          requestId,
          route: '/api/operations/[id]',
          durationMs: expect.any(Number),
        }),
      ]);
      expect(JSON.stringify(events)).not.toContain('private internal error');
      expect(JSON.stringify(events)).not.toContain('secret');
    },
  );

  it('does not log unvalidated operation identifiers or fail when logging is unavailable', async () => {
    const events: unknown[] = [];
    const response = await handle(
      new Request('http://localhost/api/transfers'),
      (context) => {
        context.setOperationId('private@example.com');
        return json({ ok: true });
      },
      (event) => events.push(event),
    );
    expect(response.status).toBe(200);
    expect(events).toEqual([expect.not.objectContaining({ operationId: expect.anything() })]);
    const safe = await handle(
      new Request('http://localhost/api/wallet'),
      () => json({ ok: true }),
      () => {
        throw new Error('sink down');
      },
    );
    expect(safe.status).toBe(200);
  });
});

describe('validated demo configuration', () => {
  it('ignores forced scenarios when demo controls are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_CONTROLS', 'false');
    vi.stubEnv('DEMO_CONTROLS', 'false');
    expect(
      demoScenario(
        new Request('http://localhost/api/transfers', {
          headers: { 'x-demo-scenario': 'success' },
        }),
      ),
    ).toBe('random');
  });
  it.each([
    ['APP_ENV', 'staging-typo'],
    ['APP_VERSION', ''],
    ['NEXT_PUBLIC_DEMO_CONTROLS', 'yes'],
    ['DEMO_CONTROLS', 'yes'],
  ])('rejects invalid configuration %s', (name, value) => {
    vi.stubEnv(name, value);
    expect(() => demoScenario(new Request('http://localhost/api/transfers'))).toThrow(
      'Invalid server configuration',
    );
  });
  it('rejects contradictory server and browser control flags', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_CONTROLS', 'true');
    vi.stubEnv('DEMO_CONTROLS', 'false');
    expect(() => demoScenario(new Request('http://localhost/api/transfers'))).toThrow(
      'Invalid server configuration',
    );
  });
});
