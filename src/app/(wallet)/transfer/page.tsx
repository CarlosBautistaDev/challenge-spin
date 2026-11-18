import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/ui';
import { TransferScreen } from '@/features/transfers/transfer-screen';
export const metadata: Metadata = { title: 'Enviar dinero' };
export default function TransferPage() { return <Suspense fallback={<LoadingState />}><TransferScreen /></Suspense>; }
