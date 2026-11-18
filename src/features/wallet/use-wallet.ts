'use client';
import { useQuery } from '@tanstack/react-query';
import { walletSchema } from '@/lib/contracts';
import { api } from '@/lib/api';
export function useWallet(state = 'normal') {
  return useQuery({
    queryKey: ['wallet', state],
    queryFn: () => api(`/api/wallet?state=${state}`, walletSchema),
    staleTime: 0,
    retry: false,
  });
}
