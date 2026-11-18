import type { NextRequest } from 'next/server';
import { scenarioSchema, type Scenario } from '@/lib/contracts';
import { AppError, asAppError } from '@/lib/errors';

export const SESSION_COOKIE = 'spin_session';
export function sessionId(request: NextRequest): string {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (!id) throw new AppError('UNAUTHORIZED', 'Tu sesión terminó. Vuelve a entrar.', 401);
  return id;
}
export async function body(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new AppError('VALIDATION', 'La solicitud no contiene JSON válido.'); }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function handle(operation: () => Promise<Response> | Response): Promise<Response> {
  try { return await operation(); } catch (error) {
    const known = asAppError(error);
    return json({ error: { code: known.code, message: known.message } }, known.status);
  }
}
export function demoScenario(request: Request): Scenario {
  if (process.env.NEXT_PUBLIC_DEMO_CONTROLS !== 'true') return 'random';
  const parsed = scenarioSchema.safeParse(request.headers.get('x-demo-scenario'));
  return parsed.success ? parsed.data : 'random';
}
export const delay = (ms = 450) => new Promise(resolve => setTimeout(resolve, ms));
