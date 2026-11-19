import type { NextRequest } from 'next/server';
import { AppError } from '@/lib/errors';
import { delay, handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
import { getServerConfig } from '@/server/config';
export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const id = sessionId(request);
    const wallet = store.wallet(id);
    await delay();
    const scenario = getServerConfig().demoControls
      ? request.nextUrl.searchParams.get('state')
      : null;
    if (scenario === 'error')
      throw new AppError('NETWORK', 'No pudimos cargar tus movimientos. Intenta nuevamente.', 503);
    return json({ ...wallet, movements: scenario === 'empty' ? [] : wallet.movements });
  });
}
