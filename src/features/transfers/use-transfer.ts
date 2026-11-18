'use client';
import { useRef, useState } from 'react';
import { receiptSchema, type Receipt, type Scenario, type TransferInput } from '@/lib/contracts';
import { api } from '@/lib/api';
import { asAppError, type AppError } from '@/lib/errors';

type Draft = Omit<TransferInput, 'idempotencyKey'>;
export type TransferState =
  | { step: 'editing' }
  | { step: 'review' | 'submitting'; input: TransferInput }
  | { step: 'error'; input: TransferInput; error: AppError }
  | { step: 'success'; receipt: Receipt };
const sendPayment = (input: TransferInput, scenario: Scenario) => api('/api/transfers', receiptSchema, {
  method: 'POST', body: JSON.stringify(input), headers: { 'x-demo-scenario': scenario },
});
export function useTransfer(send: typeof sendPayment = sendPayment) {
  const [state, setState] = useState<TransferState>({ step: 'editing' });
  const inFlight = useRef(false);
  function review(draft: Draft) {
    if (state.step !== 'editing') return;
    setState({ step: 'review', input: { ...draft, idempotencyKey: crypto.randomUUID() } });
  }
  function edit() {
    if (state.step === 'review' || (state.step === 'error' && !['TIMEOUT', 'NETWORK', 'UNKNOWN'].includes(state.error.code))) setState({ step: 'editing' });
  }
  async function confirm(scenario: Scenario) {
    if (inFlight.current || (state.step !== 'review' && state.step !== 'error')) return;
    inFlight.current = true;
    const input = state.input;
    setState({ step: 'submitting', input });
    try { setState({ step: 'success', receipt: await send(input, scenario) }); }
    catch (error) { setState({ step: 'error', input, error: asAppError(error) }); }
    finally { inFlight.current = false; }
  }
  return { state, review, edit, confirm };
}
