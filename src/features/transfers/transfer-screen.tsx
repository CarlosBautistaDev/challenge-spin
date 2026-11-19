'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Wallet as WalletIcon } from 'lucide-react';
import {
  DemoPanel,
  ErrorState,
  LoadingState,
  PageHeading,
  QueryRefreshWarning,
} from '@/components/ui';
import { useWallet } from '@/features/wallet/use-wallet';
import { formatMoney } from '@/lib/money';
import { isSessionError } from '@/lib/errors';
import type { Scenario, Wallet } from '@/lib/contracts';
import { useTransfer } from './use-transfer';
import { TransferForm } from './transfer-form';
import { TransferReview } from './transfer-review';

const outcomes: { value: Scenario; label: string }[] = [
  { value: 'random', label: 'Aleatorio (predeterminado)' },
  { value: 'success', label: 'Éxito' },
  { value: 'network', label: 'Error de red' },
  { value: 'insufficient', label: 'Fondos insuficientes' },
  { value: 'timeout', label: 'Timeout / confirmación perdida' },
  { value: 'unknown', label: 'Error desconocido' },
];
export function TransferScreen() {
  const query = useWallet();
  const searchParams = useSearchParams();
  return (
    <>
      <Link href="/home" className="back-link">
        <ArrowLeft size={15} /> Volver a mi wallet
      </Link>
      <PageHeading
        eyebrow="PARA ALGUIEN, DE TU PARTE"
        title="Un envío. Un buen momento."
        description="Elige a quién, cuánto y listo. Así de cerca."
      />
      {query.isPending ? (
        <LoadingState label="Preparando tu envío…" />
      ) : query.error && (!query.data || isSessionError(query.error)) ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {query.error && (
              <QueryRefreshWarning error={query.error} retry={() => void query.refetch()} />
            )}
            <TransferFlow wallet={query.data} initialRecipient={searchParams.get('to') ?? ''} />
          </>
        )
      )}
    </>
  );
}
function TransferFlow({ wallet, initialRecipient }: { wallet: Wallet; initialRecipient: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, edit } = useTransfer();
  const [scenario, setScenario] = useState<Scenario>('random');
  const [focusAmount, setFocusAmount] = useState(false);
  const previousStep = useRef(state.step);
  useEffect(() => {
    // Navigate only for a completion observed by this mounted transfer route.
    // Returning later to an already successful operation leaves its result reviewable.
    if (state.step === 'success' && previousStep.current !== 'success' && pathname === '/transfer')
      router.replace(`/receipt/${state.receiptId}`);
    previousStep.current = state.step;
  }, [state, pathname, router]);
  if (state.step === 'error' && isSessionError(state.error))
    return <ErrorState error={state.error} />;
  const isReview = state.step !== 'editing';
  const busy = state.step === 'submitting' || state.step === 'verifying';
  return (
    <>
      <div className="transfer-layout">
        <section className="panel transfer-panel">
          <ol className="steps" aria-label="Progreso del envío">
            <li className={!isReview ? 'active' : ''} aria-current={!isReview ? 'step' : undefined}>
              <span>{isReview ? <Check size={13} /> : '1'}</span>Datos
            </li>
            <li className={isReview ? 'active' : ''} aria-current={isReview ? 'step' : undefined}>
              <span>2</span>Revisión
            </li>
            <li>
              <span>3</span>Listo
            </li>
          </ol>
          {state.step === 'editing' ? (
            <TransferForm
              wallet={wallet}
              initialRecipient={initialRecipient}
              focusAmount={focusAmount}
            />
          ) : (
            <TransferReview
              wallet={wallet}
              scenario={scenario}
              onEdit={() => {
                setFocusAmount(true);
                edit();
              }}
            />
          )}
        </section>
        <aside className="transfer-sidebar">
          <section className="small-balance">
            <p>
              <WalletIcon size={18} /> Tu saldo disponible
            </p>
            <strong>{formatMoney(wallet.balanceCents)}</strong>
            <span>Pesos mexicanos · Cuenta demo</span>
          </section>
          <section className="panel transfer-tips">
            <h3>Para un envío sin vueltas</h3>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Elige a la persona correcta</strong>
                  <p>Verifica su nombre y sus datos.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Envía justo lo que necesitas</strong>
                  <p>El monto debe estar dentro de tu saldo.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Guarda el buen momento</strong>
                  <p>Tu comprobante estará listo al terminar.</p>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>
      <DemoPanel>
        <label htmlFor="scenario">Resultado del siguiente envío</label>
        <select
          id="scenario"
          value={scenario}
          disabled={busy}
          onChange={(event) => setScenario(event.target.value as Scenario)}
        >
          {outcomes.map((outcome) => (
            <option value={outcome.value} key={outcome.value}>
              {outcome.label}
            </option>
          ))}
        </select>
        <p>
          En modo aleatorio: 60% éxito y 10% por cada error. Timeout simula un cargo confirmado cuya
          respuesta se perdió. Verificar consulta el resultado sin enviar dinero.
        </p>
      </DemoPanel>
    </>
  );
}
