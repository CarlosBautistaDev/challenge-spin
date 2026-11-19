'use client';
import { useQuery } from '@tanstack/react-query';
import { walletSchema } from '@/lib/contracts';
import { api } from '@/lib/api';
import { useWalletSession } from '@/features/auth/wallet-session';
import { AppError } from '@/lib/errors';
import { invalidateClientSession } from '@/lib/auth-events';
export function useWallet(state = 'normal') {
  const { walletId } = useWalletSession();
  return useQuery({
    queryKey: ['wallet', walletId, state],
    queryFn: async ({ signal }) => {
      const wallet = await api(`/api/wallet?state=${encodeURIComponent(state)}`, walletSchema, {
        signal,
      });
      if (wallet.id !== walletId) {
        const error = new AppError(
          'SESSION_CHANGED',
          'La sesión cambió. Vuelve a entrar antes de continuar.',
          409,
        );
        invalidateClientSession(error);
        throw error;
      }
      return wallet;
    },
    staleTime: 0,
    retry: false,
  });
}
