import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SESSION_COOKIE } from '@/server/http';
import { store } from '@/server/store';
import { WalletSessionProvider } from '@/features/auth/wallet-session';
import { TransferProvider } from '@/features/transfers/transfer-provider';
import type { Wallet } from '@/lib/contracts';
export default async function WalletLayout({ children }: { children: React.ReactNode }) {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  let wallet: Wallet | undefined;
  if (id) {
    try {
      wallet = store.wallet(id);
    } catch {
      /* Expired demo session. */
    }
  }
  if (!wallet) redirect('/login');
  return (
    <WalletSessionProvider key={wallet.id} session={{ walletId: wallet.id, user: wallet.user }}>
      <TransferProvider walletId={wallet.id}>
        <AppShell>{children}</AppShell>
      </TransferProvider>
    </WalletSessionProvider>
  );
}
