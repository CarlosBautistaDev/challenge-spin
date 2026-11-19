import { createStore } from 'zustand/vanilla';
import { api } from '@/lib/api';
import {
  operationResultSchema,
  receiptSchema,
  transferSchema,
  type Receipt,
  type Scenario,
  type TransferInput,
} from '@/lib/contracts';
import { AppError, asAppError } from '@/lib/errors';

export type TransferDraft = { amount: string; recipientId: string; concept: string };
type Intent = Readonly<TransferInput>;
export type TransferState =
  | { step: 'editing' }
  | { step: 'review' | 'submitting' | 'verifying'; input: Intent }
  | { step: 'error'; input: Intent; error: AppError; lookup?: 'unknown' }
  | { step: 'success'; receiptId: string };
export const isUncertain = (state: TransferState) =>
  state.step === 'error' && ['TIMEOUT', 'NETWORK', 'UNKNOWN'].includes(state.error.code);
const isSessionFailure = (state: TransferState) =>
  state.step === 'error' && ['UNAUTHORIZED', 'SESSION_CHANGED'].includes(state.error.code);
const emptyDraft = (): TransferDraft => ({ amount: '', recipientId: '', concept: '' });
type TransferStore = {
  ready: boolean;
  draft: TransferDraft;
  state: TransferState;
  updateDraft: (patch: Partial<TransferDraft>) => void;
  review: (input: Omit<TransferInput, 'idempotencyKey'>) => void;
  edit: () => void;
  confirm: (scenario: Scenario) => Promise<void>;
  verify: () => Promise<void>;
  startNew: () => void;
};

export function createTransferStore(
  walletId: string,
  onCompleted: (receipt: Receipt) => void,
  onBalanceChanged: () => void,
) {
  const storageKey = `spin-pending:v1:${walletId}`;
  let active = false;
  let generation = 0;
  let controller: AbortController | undefined;
  function remember(input?: Intent) {
    try {
      if (input)
        sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, walletId, input }));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // Browsers can block storage; the mounted store still retains the intent for retry.
    }
  }
  function recover(): Intent | undefined {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || saved.walletId !== walletId) return;
      const parsed = transferSchema.safeParse(saved.input);
      if (parsed.success && parsed.data.walletId === walletId) return Object.freeze(parsed.data);
    } catch {
      // Corrupt or inaccessible storage never becomes a new transfer.
    }
  }
  const store = createStore<TransferStore>((set, get) => {
    function complete(receipt: Receipt) {
      remember();
      onCompleted(receipt);
      set({ state: { step: 'success', receiptId: receipt.id }, draft: emptyDraft() });
    }
    async function request(mode: 'send' | 'verify', scenario: Scenario = 'random') {
      const { ready, state } = get();
      if (
        !active ||
        !ready ||
        (state.step !== 'review' && state.step !== 'error') ||
        isSessionFailure(state)
      )
        return;
      if (mode === 'verify' && !isUncertain(state)) return;
      const input = state.input;
      const operationGeneration = generation;
      controller = new AbortController();
      // The synchronous store transition also guards two consumers clicking in the same tick.
      set({ state: { step: mode === 'send' ? 'submitting' : 'verifying', input } });
      if (mode === 'send') remember(input);
      try {
        if (mode === 'send') {
          const receipt = await api('/api/transfers', receiptSchema, {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'x-demo-scenario': scenario },
            signal: controller.signal,
          });
          if (!active || generation !== operationGeneration) return;
          complete(receipt);
        } else {
          const result = await api(
            `/api/operations/${input.idempotencyKey}?walletId=${walletId}`,
            operationResultSchema,
            { method: 'GET', signal: controller.signal },
          );
          if (!active || generation !== operationGeneration) return;
          if (result.status === 'completed') complete(result.receipt);
          else
            set({
              state: {
                step: 'error',
                input,
                lookup: 'unknown',
                error: new AppError(
                  'UNKNOWN',
                  'Aún no hay un resultado confirmado. Esto no significa que el envío haya fallado.',
                ),
              },
            });
        }
      } catch (error) {
        if (!active || generation !== operationGeneration) return;
        const normalized = asAppError(error);
        // A failed lookup cannot establish whether the original write reached the server.
        if (mode === 'send' && !['TIMEOUT', 'NETWORK', 'UNKNOWN'].includes(normalized.code))
          remember();
        if (['UNAUTHORIZED', 'SESSION_CHANGED'].includes(normalized.code)) remember();
        if (normalized.code === 'INSUFFICIENT_FUNDS') onBalanceChanged();
        const uncertainLookup =
          mode === 'verify' && !['UNAUTHORIZED', 'SESSION_CHANGED'].includes(normalized.code);
        set({
          state: {
            step: 'error',
            input,
            error:
              uncertainLookup && !['TIMEOUT', 'NETWORK', 'UNKNOWN'].includes(normalized.code)
                ? new AppError(
                    'UNKNOWN',
                    normalized.message,
                    normalized.status,
                    normalized.requestId,
                  )
                : normalized,
          },
        });
      } finally {
        if (generation === operationGeneration) controller = undefined;
      }
    }
    return {
      ready: false,
      draft: emptyDraft(),
      state: { step: 'editing' },
      updateDraft(patch) {
        if (active && get().ready && get().state.step === 'editing')
          set({ draft: { ...get().draft, ...patch } });
      },
      review(draft) {
        if (
          !active ||
          !get().ready ||
          get().state.step !== 'editing' ||
          draft.walletId !== walletId
        )
          return;
        const parsed = transferSchema.safeParse({ ...draft, idempotencyKey: crypto.randomUUID() });
        if (parsed.success) set({ state: { step: 'review', input: Object.freeze(parsed.data) } });
      },
      edit() {
        const { state } = get();
        if (
          state.step === 'review' ||
          (state.step === 'error' && !isUncertain(state) && !isSessionFailure(state))
        )
          set({ state: { step: 'editing' } });
      },
      confirm: (scenario) => request('send', scenario),
      verify: () => request('verify'),
      startNew() {
        if (get().state.step === 'success')
          set({ state: { step: 'editing' }, draft: emptyDraft() });
      },
    };
  });
  return {
    store,
    activate() {
      active = true;
      generation += 1;
      if (!store.getState().ready) {
        const input = recover();
        store.setState({
          ready: true,
          ...(input
            ? {
                draft: {
                  amount: (input.amountCents / 100).toFixed(2),
                  recipientId: input.recipientId,
                  concept: input.concept,
                },
                state: {
                  step: 'error',
                  input,
                  error: new AppError(
                    'TIMEOUT',
                    'Encontramos un envío pendiente de verificar. Recupera su resultado antes de iniciar otro.',
                  ),
                } as TransferState,
              }
            : {}),
        });
      }
      return () => {
        active = false;
        generation += 1;
        controller?.abort();
        controller = undefined;
        // Preserve unresolved storage on unload; explicit session changes clear it at the auth boundary.
      };
    },
  };
}
export type TransferStoreApi = ReturnType<typeof createTransferStore>['store'];
