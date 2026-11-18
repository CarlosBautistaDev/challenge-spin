import type { Metadata } from 'next';
import { ReceiptScreen } from '@/features/transfers/receipt-screen';
export const metadata: Metadata = { title: 'Comprobante' };
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) { return <ReceiptScreen id={(await params).id} />; }
