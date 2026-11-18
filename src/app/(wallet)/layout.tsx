import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SESSION_COOKIE } from '@/server/http';
import { store } from '@/server/store';
export default async function WalletLayout({ children }: { children: React.ReactNode }) {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  let valid = false;
  if (id) {
    try {
      store.wallet(id);
      valid = true;
    } catch {
      /* Expired demo session. */
    }
  }
  if (!valid) redirect('/login');
  return <AppShell>{children}</AppShell>;
}
