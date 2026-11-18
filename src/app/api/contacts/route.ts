import type { NextRequest } from 'next/server';
import { body, delay, handle, json, sessionId } from '@/server/http';
import { store } from '@/server/store';
export async function POST(request: NextRequest) {
  return handle(async () => {
    const id = sessionId(request);
    const input = await body(request);
    await delay();
    return json(store.addContact(id, input), 201);
  });
}
