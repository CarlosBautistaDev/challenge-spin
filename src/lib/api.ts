import { z } from 'zod';
import { apiErrorSchema } from './contracts';
import { AppError, isSessionError } from './errors';
import { invalidateClientSession } from './auth-events';

export async function api<T>(
  url: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const callerSignal = options.signal;
  const abortFromCaller = () => controller.abort();
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  if (callerSignal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let requestId: string | undefined;
  try {
    if (callerSignal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
    });
    const reference = z.uuid().safeParse(response.headers.get('X-Request-ID'));
    if (reference.success) requestId = reference.data;
    const data: unknown = await response.json();
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(data);
      if (parsed.success)
        throw new AppError(
          parsed.data.error.code,
          parsed.data.error.message,
          response.status,
          parsed.data.error.requestId ?? requestId,
        );
      throw new AppError(
        'UNKNOWN',
        'El servicio devolvió una respuesta inesperada.',
        response.status,
        requestId,
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new AppError(
        'UNKNOWN',
        'No pudimos interpretar la respuesta del servicio.',
        502,
        requestId,
      );
    return parsed.data;
  } catch (error) {
    if (callerSignal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
    if (error instanceof AppError) {
      if (isSessionError(error)) invalidateClientSession(error);
      throw error;
    }
    if (controller.signal.aborted)
      throw new AppError(
        'TIMEOUT',
        'La confirmación tardó demasiado. Verifica el resultado antes de iniciar otro envío.',
        504,
        requestId,
      );
    if (error instanceof SyntaxError)
      throw new AppError(
        'UNKNOWN',
        'El servicio devolvió una respuesta inesperada.',
        502,
        requestId,
      );
    throw new AppError(
      'NETWORK',
      'Se perdió la conexión. Reintenta para verificar el resultado.',
      503,
      requestId,
    );
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}
