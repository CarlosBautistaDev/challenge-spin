'use client';
import { useRef, useState } from 'react';
import {
  receiptSchema,
  transferSchema,
  type Receipt,
  type Scenario,
  type TransferInput,
} from '@/lib/contracts';
import { api } from '@/lib/api';
import { AppError, asAppError } from '@/lib/errors';

type Draft = Omit<TransferInput, 'idempotencyKey'>;
export type TransferState =
  | { step: 'editing' }
  | { step: 'review' | 'submitting'; input: TransferInput }
  | { step: 'error'; input: TransferInput; error: AppError }
  | { step: 'success'; receipt: Receipt };
const sendPayment = (input: TransferInput, scenario: Scenario) =>
  api('/api/transfers', receiptSchema, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'x-demo-scenario': scenario },
  });
function recover(walletId?: string): TransferState {
  if (!walletId || typeof window === 'undefined') return { step: 'editing' };
  try {
    const raw = sessionStorage.getItem(`spin-pending:${walletId}`);
    if (!raw) return { step: 'editing' };
    const input = transferSchema.safeParse(JSON.parse(raw));
    if (input.success && input.data.walletId === walletId)
      return {
        step: 'error',
        input: input.data,
        error: new AppError(
          'TIMEOUT',
          'Encontramos un envío pendiente de verificar. Recupera su resultado antes de iniciar otro.',
        ),
      };
  } catch {
    /* Storage may be unavailable or corrupted; the server remains authoritative. */
  }
  return { step: 'editing' };
}
function remember(walletId: string | undefined, input?: TransferInput) {
  if (!walletId) return;
  try {
    if (input) sessionStorage.setItem(`spin-pending:${walletId}`, JSON.stringify(input));
    else sessionStorage.removeItem(`spin-pending:${walletId}`);
  } catch {
    /* In-memory retry still works when browser storage is blocked. */
  }
}
export function useTransfer(send: typeof sendPayment = sendPayment, walletId?: string) {
  // Mounted after the client wallet query resolves; no server-side storage access.
  const [state, setState] = useState<TransferState>(() => recover(walletId));
  const inFlight = useRef(false);
  function review(draft: Draft) {
    if (state.step !== 'editing') return;
    setState({ step: 'review', input: { ...draft, idempotencyKey: crypto.randomUUID() } });
  }
  function edit() {
    if (
      state.step === 'review' ||
      (state.step === 'error' &&
        !['TIMEOUT', 'NETWORK', 'UNKNOWN', 'UNAUTHORIZED', 'SESSION_CHANGED'].includes(
          state.error.code,
        ))
    ) {
      remember(walletId);
      setState({ step: 'editing' });
    }
  }
  async function confirm(scenario: Scenario) {
    if (inFlight.current || (state.step !== 'review' && state.step !== 'error')) return;
    if (state.step === 'error' && ['UNAUTHORIZED', 'SESSION_CHANGED'].includes(state.error.code))
      return;
    inFlight.current = true;
    const input = state.input;
    remember(walletId, input);
    setState({ step: 'submitting', input });
    try {
      const receipt = await send(input, scenario);
      remember(walletId);
      setState({ step: 'success', receipt });
    } catch (error) {
      const normalized = asAppError(error);
      if (
        ['VALIDATION', 'INSUFFICIENT_FUNDS', 'UNAUTHORIZED', 'SESSION_CHANGED'].includes(
          normalized.code,
        )
      )
        remember(walletId);
      setState({ step: 'error', input, error: normalized });
    } finally {
      inFlight.current = false;
    }
  }
  return { state, review, edit, confirm };
}
