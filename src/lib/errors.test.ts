import { describe, expect, it } from 'vitest';
import { asAppError } from './errors';
describe('error normalization across hot reload boundaries', () => {
  it('preserves a known service error from a different module instance', () => {
    const fromPreviousModule = Object.assign(new Error('La clave ya existe'), {
      name: 'AppError',
      code: 'CONFLICT',
      status: 409,
    });
    expect(asAppError(fromPreviousModule)).toMatchObject({ code: 'CONFLICT', status: 409 });
  });
  it('does not leak unexpected internal failures', () => {
    expect(asAppError(new Error('private internals')).message).not.toContain('private');
  });
});
