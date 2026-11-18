import { describe, expect, it } from 'vitest';
import { parseMoney, formatMoney } from './money';
import { loginSchema, transferSchema } from './contracts';

describe('money input', () => {
  it.each([['0.01', 1], ['1250.50', 125050], ['12,50', 1250], [' 10 ', 1000], ['0', 0]])('parses %s exactly', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });
  it.each(['', '-1', '1e3', 'NaN', 'Infinity', '1.001', '1,000.00', '9007199254740991', '.5', '12abc'])('rejects ambiguous or unsafe input %s', (input) => {
    expect(parseMoney(input)).toBeNull();
  });
  it('formats pesos with two decimals', () => expect(formatMoney(123456)).toContain('1,234.56'));
});
describe('contracts', () => {
  it.each(['demo@example.com', '5512345678', '+52 55 1234 5678'])('accepts email or Mexican phone %s', identity => {
    expect(loginSchema.safeParse({ identity }).success).toBe(true);
  });
  it.each(['', 'hello', 'a@', '123', '1234567890123'])('rejects invalid identity %s', identity => {
    expect(loginSchema.safeParse({ identity }).success).toBe(false);
  });
  it.each([0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1])('rejects invalid cents %s', amountCents => {
    expect(transferSchema.safeParse({ amountCents, recipientId: 'contact-ana', idempotencyKey: crypto.randomUUID(), concept: '' }).success).toBe(false);
  });
  it('requires a recipient', () => {
    expect(transferSchema.safeParse({ amountCents: 10, recipientId: '', idempotencyKey: crypto.randomUUID() }).success).toBe(false);
  });
});
