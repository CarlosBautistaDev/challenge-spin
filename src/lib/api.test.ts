import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { api } from './api';
afterEach(() => vi.useRealTimers());
describe('HTTP client', () => {
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
