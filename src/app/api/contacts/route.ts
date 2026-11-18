import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { contactInputSchema } from '@/lib/contracts';
import { AppError } from '@/lib/errors';
import { body, delay, handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
const inputSchema = contactInputSchema.extend({ walletId: z.uuid() });
export async function POST(request: NextRequest) {
  return handle(async () => {
    const id = sessionId(request);
    const input = inputSchema.safeParse(await body(request));
    if (!input.success) throw new AppError('VALIDATION', 'Revisa los datos del contacto.');
    await delay();
    return json(store.addContact(id, input.data, input.data.walletId), 201);
  });
}
