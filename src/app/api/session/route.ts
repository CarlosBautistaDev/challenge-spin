import { cookies } from 'next/headers';
import { type NextRequest } from 'next/server';
import { loginSchema } from '@/lib/contracts';
import { AppError } from '@/lib/errors';
import { body, delay, handle, json, SESSION_COOKIE } from '@/server/http';
import { SESSION_TTL_SECONDS, store } from '@/server/store';

export async function POST(request: NextRequest) {
  return handle(request, async () => {
    const parsed = loginSchema.safeParse(await body(request));
    if (!parsed.success)
      throw new AppError('VALIDATION', 'Escribe un correo válido o un teléfono de 10 dígitos.');
    await delay();
    if (parsed.data.identity === 'error@demo.mx')
      throw new AppError('NETWORK', 'No pudimos iniciar tu sesión. Intenta nuevamente.', 503);
    const cookieStore = await cookies();
    const old = cookieStore.get(SESSION_COOKIE)?.value;
    if (old) store.deleteSession(old);
    const id = store.createSession(parsed.data.identity);
    cookieStore.set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return json({ user: store.wallet(id).user }, 201);
  });
}
export async function DELETE(request: NextRequest) {
  return handle(request, async () => {
    const cookieStore = await cookies();
    const id = cookieStore.get(SESSION_COOKIE)?.value;
    if (id) store.deleteSession(id);
    cookieStore.delete(SESSION_COOKIE);
    return json({ ok: true });
  });
}
