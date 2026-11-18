import { z } from 'zod';

export const identitySchema = z.string().trim().max(120).refine(value =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^(?:\+52)?\d{10}$/.test(value.replace(/[\s()-]/g, '')),
  'Escribe un correo válido o un teléfono de 10 dígitos.',
).transform(value => value.includes('@') ? value.toLowerCase() : value.replace(/[\s()-]/g, '').replace(/^\+52/, ''));
export const loginSchema = z.object({ identity: identitySchema });
export const contactInputSchema = z.object({ name: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(60), identity: identitySchema });
export const contactSchema = contactInputSchema.extend({ id: z.string() });
export type Contact = z.infer<typeof contactSchema>;
export const scenarioSchema = z.enum(['random', 'success', 'network', 'insufficient', 'timeout', 'unknown']);
export type Scenario = z.infer<typeof scenarioSchema>;
export const transferSchema = z.object({
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  recipientId: z.string().min(1),
  concept: z.string().trim().max(80).default(''),
  idempotencyKey: z.uuid(),
});
export type TransferInput = z.infer<typeof transferSchema>;
export const receiptSchema = z.object({
  id: z.string(), amountCents: z.number().int(), recipient: contactSchema,
  concept: z.string(), createdAt: z.iso.datetime(), reference: z.string(),
  status: z.literal('completed'),
});
export type Receipt = z.infer<typeof receiptSchema>;
export const movementSchema = z.object({
  id: z.string(), title: z.string(), subtitle: z.string(), amountCents: z.number().int(),
  kind: z.enum(['incoming', 'outgoing', 'purchase']), createdAt: z.iso.datetime(), receiptId: z.string().optional(),
});
export type Movement = z.infer<typeof movementSchema>;
export const walletSchema = z.object({
  user: z.object({ name: z.string(), identity: z.string() }),
  balanceCents: z.number().int(), contacts: z.array(contactSchema), movements: z.array(movementSchema),
});
export type Wallet = z.infer<typeof walletSchema>;
export const errorCodeSchema = z.enum(['VALIDATION', 'UNAUTHORIZED', 'NOT_FOUND', 'CONFLICT', 'NETWORK', 'INSUFFICIENT_FUNDS', 'TIMEOUT', 'UNKNOWN']);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export const apiErrorSchema = z.object({ error: z.object({ code: errorCodeSchema, message: z.string() }) });
