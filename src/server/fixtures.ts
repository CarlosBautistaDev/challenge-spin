import type { Wallet } from '@/lib/contracts';

/** Synthetic opening balance and history for each isolated demo wallet. */
export function createDemoWallet(identity: string, now: number): Wallet {
  return {
    id: crypto.randomUUID(),
    user: { name: 'Alex Morgan', identity },
    balanceCents: 2450000,
    contacts: [
      { id: 'ana', name: 'Ana López', identity: '5510102030' },
      { id: 'diego', name: 'Diego García', identity: '5520203040' },
      { id: 'sofia', name: 'Sofía Martínez', identity: '5530304050' },
      { id: 'pablo', name: 'Pablo Ruiz', identity: '5540405060' },
    ],
    movements: [
      {
        id: 'seed-1',
        title: 'Depósito recibido',
        subtitle: 'Transferencia · Nómina',
        kind: 'incoming',
        amountCents: 1800000,
        createdAt: new Date(now - 3600000).toISOString(),
      },
      {
        id: 'seed-2',
        title: 'Café de la mañana',
        subtitle: 'Compra · Cafetería',
        kind: 'purchase',
        amountCents: 8500,
        createdAt: new Date(now - 7200000).toISOString(),
      },
      {
        id: 'seed-3',
        title: 'Ana López',
        subtitle: 'Transferencia · Cena del viernes',
        kind: 'outgoing',
        amountCents: 35000,
        createdAt: new Date(now - 86400000).toISOString(),
      },
      {
        id: 'seed-4',
        title: 'Compra en OXXO',
        subtitle: 'Compra · Tienda',
        kind: 'purchase',
        amountCents: 15650,
        createdAt: new Date(now - 90000000).toISOString(),
      },
    ],
  };
}
