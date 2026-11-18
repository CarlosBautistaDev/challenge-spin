import { errorCodeSchema, type ErrorCode } from './contracts';
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  // A dev singleton can retain errors created by a previous module instance.
  if (error instanceof Error && error.name === 'AppError' && 'code' in error && 'status' in error) {
    const code = errorCodeSchema.safeParse(error.code);
    if (
      code.success &&
      typeof error.status === 'number' &&
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status <= 599
    ) {
      return new AppError(code.data, error.message, error.status);
    }
  }
  return new AppError('UNKNOWN', 'Algo salió mal. Intenta de nuevo en un momento.', 500);
}
