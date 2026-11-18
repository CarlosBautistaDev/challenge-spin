import {
  contactInputSchema,
  loginSchema,
  transferSchema,
  type Contact,
  type Receipt,
  type Scenario,
  type TransferInput,
  type Wallet,
} from '@/lib/contracts';
import { AppError } from '@/lib/errors';

export const SESSION_TTL_SECONDS = 60 * 60 * 24;
type Session = {
  wallet: Wallet;
  expiresAt: number;
  payments: Map<string, { fingerprint: string; receipt: Receipt }>;
};

/** Single-process demo repository. No I/O occurs between balance check and debit. */
export class WalletStore {
  constructor(
    private readonly random: () => number = Math.random,
    private readonly sessions: Map<string, Session> = new Map(),
  ) {}

  createSession(identity: string): string {
    const result = loginSchema.safeParse({ identity });
    if (!result.success) throw new AppError('VALIDATION', 'Escribe un correo o teléfono válido.');
    for (const [id, session] of this.sessions)
      if (session.expiresAt <= Date.now()) this.sessions.delete(id);
    if (this.sessions.size >= 500)
      throw new AppError('UNKNOWN', 'La demo está ocupada. Intenta más tarde.', 503);
    const id = crypto.randomUUID();
    const now = Date.now();
    this.sessions.set(id, {
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
      payments: new Map(),
      wallet: {
        id: crypto.randomUUID(),
        user: { name: 'Alex Morgan', identity: result.data.identity },
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
      },
    });
    return id;
  }

  private session(id: string): Session {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      throw new AppError('UNAUTHORIZED', 'Tu sesión terminó. Vuelve a entrar.', 401);
    }
    return session;
  }
  wallet(id: string): Wallet {
    return structuredClone(this.session(id).wallet);
  }
  deleteSession(id: string) {
    this.sessions.delete(id);
  }

  addContact(id: string, input: unknown, expectedWalletId: string): Contact {
    const wallet = this.session(id).wallet;
    if (wallet.id !== expectedWalletId)
      throw new AppError(
        'SESSION_CHANGED',
        'La sesión cambió. Vuelve a entrar antes de continuar.',
        409,
      );
    const result = contactInputSchema.safeParse(input);
    if (!result.success)
      throw new AppError('VALIDATION', 'Revisa el nombre y el correo o teléfono del contacto.');
    if (wallet.contacts.some((c) => c.identity === result.data.identity))
      throw new AppError('CONFLICT', 'Este contacto ya existe en tus favoritos.', 409);
    if (wallet.contacts.length >= 50)
      throw new AppError('VALIDATION', 'Puedes guardar hasta 50 contactos en esta demo.');
    const contact = { ...result.data, id: crypto.randomUUID() };
    wallet.contacts.push(contact);
    return structuredClone(contact);
  }

  async transfer(
    id: string,
    input: TransferInput,
    scenario: Scenario = 'random',
  ): Promise<Receipt> {
    const session = this.session(id);
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError('VALIDATION', 'Revisa el monto y el destinatario de tu transferencia.');
    const request = parsed.data;
    if (request.walletId !== session.wallet.id)
      throw new AppError(
        'SESSION_CHANGED',
        'La sesión cambió. Vuelve a entrar antes de continuar.',
        409,
      );
    const fingerprint = JSON.stringify([request.amountCents, request.recipientId, request.concept]);
    const previous = session.payments.get(request.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new AppError(
          'CONFLICT',
          'La clave de esta operación ya se usó con otros datos.',
          409,
        );
      return structuredClone(previous.receipt);
    }
    const recipient = session.wallet.contacts.find((c) => c.id === request.recipientId);
    if (!recipient)
      throw new AppError('VALIDATION', 'Selecciona un destinatario de tus contactos.');
    if (request.amountCents > session.wallet.balanceCents)
      throw new AppError(
        'INSUFFICIENT_FUNDS',
        'Tu saldo disponible no alcanza para este envío.',
        422,
      );
    const outcome = scenario === 'random' ? this.chooseScenario() : scenario;
    if (outcome === 'network')
      throw new AppError(
        'NETWORK',
        'No pudimos conectar con el servicio. Tu dinero no se movió.',
        503,
      );
    if (outcome === 'insufficient')
      throw new AppError(
        'INSUFFICIENT_FUNDS',
        'El servicio rechazó el envío por fondos insuficientes. Revisa tu saldo.',
        422,
      );
    if (outcome === 'unknown')
      throw new AppError(
        'UNKNOWN',
        'No pudimos completar el envío. Intenta de nuevo en un momento.',
        500,
      );
    if (session.payments.size >= 500)
      throw new AppError('VALIDATION', 'Llegaste al límite de operaciones de esta sesión demo.');
    const receipt: Receipt = {
      id: crypto.randomUUID(),
      amountCents: request.amountCents,
      recipient: structuredClone(recipient),
      concept: request.concept,
      createdAt: new Date().toISOString(),
      reference: crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase(),
      status: 'completed',
    };
    // Atomic only within this process: replace with a DB transaction + unique key in production.
    session.wallet.balanceCents -= request.amountCents;
    session.payments.set(request.idempotencyKey, { fingerprint, receipt });
    session.wallet.movements.unshift({
      id: receipt.id,
      title: recipient.name,
      subtitle: `Transferencia${request.concept ? ` · ${request.concept}` : ''}`,
      kind: 'outgoing',
      amountCents: request.amountCents,
      createdAt: receipt.createdAt,
      receiptId: receipt.id,
    });
    if (outcome === 'timeout')
      throw new AppError(
        'TIMEOUT',
        'La confirmación tardó demasiado. Verifica el resultado antes de iniciar otro envío.',
        504,
      );
    return structuredClone(receipt);
  }
  private chooseScenario(): Exclude<Scenario, 'random'> {
    const value = this.random();
    if (value < 0.6) return 'success';
    if (value < 0.7) return 'network';
    if (value < 0.8) return 'insufficient';
    if (value < 0.9) return 'timeout';
    return 'unknown';
  }
  receipt(id: string, receiptId: string): Receipt {
    for (const { receipt } of this.session(id).payments.values())
      if (receipt.id === receiptId) return structuredClone(receipt);
    throw new AppError('NOT_FOUND', 'No encontramos este comprobante en tu sesión.', 404);
  }
}

// Keep data across hot reload, but recreate the service so edited methods take effect.
// Each Node process still owns a separate map; this is not distributed storage.
const globalStore = globalThis as typeof globalThis & { spinSessions?: Map<string, Session> };
const sessions = (globalStore.spinSessions ??= new Map<string, Session>());
export const store = new WalletStore(Math.random, sessions);
