import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { api } from './api';
afterEach(() => vi.useRealTimers());
describe('HTTP client', () => {
  it('preserves a safe support reference when the error body is malformed', async () => {
    const requestId = '00000000-0000-4000-8000-000000000123';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>Gateway error</html>', {
        status: 502,
        headers: { 'X-Request-ID': requestId },
      }),
    );
    await expect(api('/demo', z.unknown())).rejects.toMatchObject({ code: 'UNKNOWN', requestId });
  });
  it('cancels an obsolete query using the caller signal without reporting a payment timeout', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const request = api('/demo', z.unknown(), { signal: controller.signal });
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
  });
  it('accepts native Headers without dropping the caller header', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true }));
    await api('/demo', z.object({ ok: z.boolean() }), {
      headers: new Headers({ 'x-demo-scenario': 'success' }),
    });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('x-demo-scenario')).toBe('success');
  });
  it('validates successful payloads at runtime', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ value: 'wrong type' }));
    await expect(api('/demo', z.object({ value: z.number() }))).rejects.toMatchObject({
      code: 'UNKNOWN',
    });
  });
  it('keeps structured server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { error: { code: 'INSUFFICIENT_FUNDS', message: 'Sin saldo' } },
        { status: 422 },
      ),
    );
    await expect(api('/demo', z.unknown())).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      status: 422,
    });
  });
  it('handles a real connection rejection as network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/demo', z.unknown())).rejects.toMatchObject({ code: 'NETWORK' });
  });
  it('aborts a hung request after the deadline', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const promise = api('/demo', z.unknown());
    const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
  });
});
