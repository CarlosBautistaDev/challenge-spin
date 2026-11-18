import { z } from 'zod';
import { apiErrorSchema } from './contracts';
import { AppError } from './errors';

export async function api<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      ...options, signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(data);
      if (parsed.success) throw new AppError(parsed.data.error.code, parsed.data.error.message, response.status);
      throw new AppError('UNKNOWN', 'El servicio devolvió una respuesta inesperada.', response.status);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new AppError('UNKNOWN', 'No pudimos interpretar la respuesta del servicio.', 502);
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (controller.signal.aborted) throw new AppError('TIMEOUT', 'La confirmación tardó demasiado. Verifica el resultado antes de iniciar otro envío.', 504);
    if (error instanceof SyntaxError) throw new AppError('UNKNOWN', 'El servicio devolvió una respuesta inesperada.', 502);
    throw new AppError('NETWORK', 'Se perdió la conexión. Reintenta para verificar el resultado.', 503);
  } finally { clearTimeout(timeout); }
}
