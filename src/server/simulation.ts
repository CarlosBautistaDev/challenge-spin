import type { Scenario } from '@/lib/contracts';
import { AppError } from '@/lib/errors';

export function chooseDemoScenario(random: () => number): Exclude<Scenario, 'random'> {
  const value = random();
  if (value < 0.6) return 'success';
  if (value < 0.7) return 'network';
  if (value < 0.8) return 'insufficient';
  if (value < 0.9) return 'timeout';
  return 'unknown';
}

export function simulateBeforeCommit(outcome: Exclude<Scenario, 'random'>) {
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
}

export function simulateAfterCommit(outcome: Exclude<Scenario, 'random'>) {
  if (outcome === 'timeout')
    throw new AppError(
      'TIMEOUT',
      'La confirmación tardó demasiado. Verifica el resultado antes de iniciar otro envío.',
      504,
    );
}

export const delay = (ms = 450) => new Promise((resolve) => setTimeout(resolve, ms));
