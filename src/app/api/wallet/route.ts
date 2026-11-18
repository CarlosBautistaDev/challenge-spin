import type { NextRequest } from 'next/server';
import { AppError } from '@/lib/errors';
import { delay, handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
export async function GET(request: NextRequest) {
  return handle(async () => {
    const id = sessionId(request);
    const wallet = store.wallet(id);
    await delay();
    const scenario = process.env.NEXT_PUBLIC_DEMO_CONTROLS === 'true' ? request.nextUrl.searchParams.get('state') : null;
    if (scenario === 'error') throw new AppError('NETWORK', 'No pudimos cargar tus movimientos. Intenta nuevamente.', 503);
    return json({ ...wallet, movements: scenario === 'empty' ? [] : wallet.movements });
  });
}
