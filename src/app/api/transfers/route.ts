import type { NextRequest } from 'next/server';
import { transferSchema } from '@/lib/contracts';
import { AppError } from '@/lib/errors';
import { body, delay, demoScenario, handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const id = sessionId(request);
    const input = transferSchema.safeParse(await body(request));
    if (!input.success) throw new AppError('VALIDATION', 'Revisa el monto, destinatario y concepto de tu envío.');
    const scenario = demoScenario(request);
    await delay(scenario === 'timeout' ? 1800 : 650);
    return json(await store.transfer(id, input.data, scenario), 201);
  });
}
