import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';

const querySchema = z.object({ idempotencyKey: z.uuid(), walletId: z.uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ idempotencyKey: string }> },
) {
  return handle(request, async (diagnostics) => {
    const id = sessionId(request);
    const parsed = querySchema.safeParse({
      idempotencyKey: (await context.params).idempotencyKey,
      walletId: request.nextUrl.searchParams.get('walletId'),
    });
    if (!parsed.success) throw new AppError('VALIDATION', 'Revisa la referencia de tu operación.');
    diagnostics.setOperationId(parsed.data.idempotencyKey);
    return json(store.operation(id, parsed.data.idempotencyKey, parsed.data.walletId));
  });
}
