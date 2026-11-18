import type { ErrorCode } from './contracts';
export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly status = 400) {
    super(message);
    this.name = 'AppError';
  }
}
export function asAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('UNKNOWN', 'Algo salió mal. Intenta de nuevo en un momento.', 500);
}
