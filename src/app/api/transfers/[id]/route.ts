import type { NextRequest } from 'next/server';
import { handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle(request, async () =>
    json(store.receipt(sessionId(request), (await context.params).id)),
  );
}
