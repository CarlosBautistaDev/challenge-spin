import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { scenarioSchema, type Scenario } from '@/lib/contracts';
import { AppError, asAppError } from '@/lib/errors';
import { getServerConfig } from './config';
import type { TransferObserver } from './store';

export { delay } from './simulation';

export const SESSION_COOKIE = 'spin_session';
export function sessionId(request: NextRequest): string {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (!id) throw new AppError('UNAUTHORIZED', 'Tu sesión terminó. Vuelve a entrar.', 401);
  return id;
}
export async function body(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'La solicitud no contiene JSON válido.');
  }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
type DiagnosticEvent = {
  event: 'request.finished' | 'transfer.committed' | 'transfer.replayed';
  requestId: string;
  route: string;
  method: string;
  environment: string;
  appVersion: string;
  simulation: true;
  operationId?: string;
  httpStatus?: number;
  errorCode?: string;
  durationMs?: number;
};
type DiagnosticSink = (event: DiagnosticEvent) => void;
type RequestContext = {
  setOperationId: (operationId: string) => void;
  observeTransfer: TransferObserver;
};

function normalizedRoute(request: Request): string {
  const path = new URL(request.url).pathname;
  if (/^\/api\/(session|wallet|contacts|transfers)$/.test(path)) return path;
  if (/^\/api\/transfers\/[^/]+$/.test(path)) return '/api/transfers/[id]';
  if (/^\/api\/operations\/[^/]+$/.test(path)) return '/api/operations/[id]';
  return '/api/[unknown]';
}

export async function handle(
  request: Request,
  operation: (context: RequestContext) => Promise<Response> | Response,
  sink: DiagnosticSink = (event) => console.info(JSON.stringify(event)),
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const route = normalizedRoute(request);
  const method = /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(request.method)
    ? request.method
    : 'OTHER';
  let config: ReturnType<typeof getServerConfig> | undefined;
  let operationId: string | undefined;
  let errorCode: string | undefined;
  const emit = (event: Pick<DiagnosticEvent, 'event' | 'httpStatus' | 'durationMs'>) => {
    try {
      sink({
        event: event.event,
        requestId,
        route,
        method,
        environment: config?.environment ?? 'invalid',
        appVersion: config?.appVersion ?? 'invalid',
        simulation: true,
        ...(operationId ? { operationId } : {}),
        ...(event.httpStatus === undefined ? {} : { httpStatus: event.httpStatus }),
        ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
        ...(errorCode ? { errorCode } : {}),
      });
    } catch {
      // Observability is best effort and cannot interrupt a payment or its response.
    }
  };
  const context: RequestContext = {
    setOperationId(value) {
      if (z.uuid().safeParse(value).success) operationId = value;
    },
    observeTransfer(event, value) {
      if (!z.uuid().safeParse(value).success) return;
      operationId = value;
      emit({ event });
    },
  };
  let response: Response;
  try {
    config = getServerConfig();
    response = await operation(context);
  } catch (error) {
    const known = asAppError(error);
    errorCode = known.code;
    response = json(
      { error: { code: known.code, message: known.message, requestId } },
      known.status,
    );
  }
  response.headers.set('X-Request-ID', requestId);
  emit({
    event: 'request.finished',
    httpStatus: response.status,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return response;
}
export function demoScenario(request: Request): Scenario {
  if (!getServerConfig().demoControls) return 'random';
  const parsed = scenarioSchema.safeParse(request.headers.get('x-demo-scenario'));
  return parsed.success ? parsed.data : 'random';
}
