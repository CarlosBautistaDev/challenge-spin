'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Wallet as WalletIcon,
  LoaderCircle,
} from 'lucide-react';
import { Avatar, Button, DemoPanel, ErrorState, LoadingState, PageHeading } from '@/components/ui';
import { ContactForm } from '@/features/contacts/contact-form';
import { useWallet } from '@/features/wallet/use-wallet';
import { formatMoney, parseMoney } from '@/lib/money';
import type { Scenario, Wallet } from '@/lib/contracts';
import { useTransfer } from './use-transfer';

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
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <TransferFlow wallet={query.data} initialRecipient={searchParams.get('to') ?? ''} />
        )
      )}
    </>
  );
}
function TransferFlow({ wallet, initialRecipient }: { wallet: Wallet; initialRecipient: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const { state, review, edit, confirm } = useTransfer(undefined, wallet.id);
  const [recipientId, setRecipientId] = useState(
    'input' in state
      ? state.input.recipientId
      : wallet.contacts.some((c) => c.id === initialRecipient)
        ? initialRecipient
        : '',
  );
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scenario, setScenario] = useState<Scenario>('random');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const recipient = wallet.contacts.find(
    (c) => c.id === ('input' in state ? state.input.recipientId : recipientId),
  );
  const busy = state.step === 'submitting';
  const uncertain =
    state.step === 'error' && ['NETWORK', 'TIMEOUT', 'UNKNOWN'].includes(state.error.code);
  useEffect(() => {
    if (state.step === 'error' && state.error.code === 'INSUFFICIENT_FUNDS') {
      void client.invalidateQueries({ queryKey: ['wallet'] });
    }
    if (state.step === 'success') {
      void client.invalidateQueries({ queryKey: ['wallet'] });
      router.replace(`/receipt/${state.receipt.id}`);
    }
    if (state.step === 'review' || state.step === 'error') headingRef.current?.focus();
  }, [state, router, client]);
  useEffect(() => {
    if (state.step !== 'submitting' && !uncertain) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.step, uncertain]);
  function prepare(event: FormEvent) {
    event.preventDefault();
    if (adding) return;
    const cents = parseMoney(amount);
    const next: Record<string, string> = {};
    if (!recipient) next.recipient = 'Elige una persona para tu envío.';
    if (cents === null || cents <= 0)
      next.amount = 'Escribe un monto mayor a $0, con hasta 2 decimales.';
    else if (cents > wallet.balanceCents) next.amount = 'El monto supera tu saldo disponible.';
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.recipient)
        document.querySelector<HTMLInputElement>('input[name="recipient"]')?.focus();
      else amountRef.current?.focus();
      return;
    }
    review({ walletId: wallet.id, amountCents: cents!, recipientId, concept: concept.trim() });
  }
  if (state.step === 'error' && ['UNAUTHORIZED', 'SESSION_CHANGED'].includes(state.error.code))
    return <ErrorState error={state.error} />;
  const isReview = state.step !== 'editing';
  const reviewInput = 'input' in state ? state.input : null;
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
          {!isReview ? (
            <>
              <div className="transfer-section-title">
                <h2>¿A quién le enviamos?</h2>
                <Button variant="ghost" onClick={() => setAdding(!adding)} aria-expanded={adding}>
                  <Plus size={16} /> Nuevo contacto
                </Button>
              </div>
              {adding && (
                <ContactForm
                  walletId={wallet.id}
                  onSaved={(c) => {
                    setRecipientId(c.id);
                    setAdding(false);
                    setErrors({});
                  }}
                  onCancel={() => setAdding(false)}
                />
              )}
              <form onSubmit={prepare} noValidate>
                <fieldset
                  className="recipient-options"
                  aria-describedby={errors.recipient ? 'recipient-error' : undefined}
                >
                  <legend className="sr-only">Selecciona un destinatario</legend>
                  {wallet.contacts.map((contact, i) => (
                    <label
                      key={contact.id}
                      className={`recipient-option ${recipientId === contact.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="recipient"
                        value={contact.id}
                        checked={recipientId === contact.id}
                        onChange={() => {
                          setRecipientId(contact.id);
                          setErrors((current) => ({ ...current, recipient: '' }));
                        }}
                      />
                      <Avatar name={contact.name} index={i} />
                      <span className="recipient-text">
                        <strong>{contact.name}</strong>
                        <small>{contact.identity}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {errors.recipient && (
                  <p className="field-error" role="alert" id="recipient-error">
                    {errors.recipient}
                  </p>
                )}
                <div className="field">
                  <label htmlFor="amount">¿Cuánto quieres enviar?</label>
                  <div className="amount-input">
                    <span aria-hidden="true">$</span>
                    <input
                      ref={amountRef}
                      id="amount"
                      name="amount"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amount}
                      maxLength={16}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setErrors((current) => ({ ...current, amount: '' }));
                      }}
                      aria-invalid={!!errors.amount}
                      aria-describedby={errors.amount ? 'amount-error' : 'amount-hint'}
                    />
                    <span>MXN</span>
                  </div>
                  {errors.amount ? (
                    <p className="field-error" role="alert" id="amount-error">
                      {errors.amount}
                    </p>
                  ) : (
                    <p className="field-hint" id="amount-hint">
                      Disponible: {formatMoney(wallet.balanceCents)} MXN · Sin comisión en esta
                      demo.
                    </p>
                  )}
                  <div className="amount-presets">
                    {[100, 500, 1000].map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => {
                          setAmount(String(value));
                          setErrors((current) => ({ ...current, amount: '' }));
                        }}
                      >
                        ${value.toLocaleString('es-MX')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="concept">Concepto</label>
                    <span>Opcional · {concept.length}/80</span>
                  </div>
                  <input
                    id="concept"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    maxLength={80}
                    placeholder="Ej. Para la cena del viernes"
                  />
                </div>
                <Button type="submit" className="full-width" disabled={adding}>
                  Revisar envío <ArrowRight size={17} />
                </Button>
                <p className="transfer-note">
                  <LockKeyhole size={13} /> Aún no se descontará dinero de tu saldo.
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="review-heading">
                <h2 tabIndex={-1} ref={headingRef}>
                  Todo listo para tu envío.
                </h2>
                <p>Un último vistazo antes de confirmar.</p>
                {reviewInput && (
                  <div className="review-amount">{formatMoney(reviewInput.amountCents)}</div>
                )}
              </div>
              {recipient && (
                <div className="review-recipient">
                  <Avatar name={recipient.name} />
                  <div>
                    <strong>{recipient.name}</strong>
                    <p>{recipient.identity}</p>
                  </div>
                </div>
              )}
              {reviewInput && (
                <dl className="detail-list">
                  <div>
                    <dt>Desde</dt>
                    <dd>Mi wallet · MXN</dd>
                  </div>
                  <div>
                    <dt>Concepto</dt>
                    <dd>{reviewInput.concept || 'Sin concepto'}</dd>
                  </div>
                  <div>
                    <dt>Comisión</dt>
                    <dd>{formatMoney(0)}</dd>
                  </div>
                  <div className="total">
                    <dt>Total a enviar</dt>
                    <dd>{formatMoney(reviewInput.amountCents)}</dd>
                  </div>
                </dl>
              )}
              {state.step === 'review' && (
                <p className="review-warning">
                  Comprueba que el destinatario y el monto sean correctos antes de continuar.
                </p>
              )}
              {state.step === 'error' && (
                <div className="transfer-error" role="alert">
                  <h3>
                    <AlertCircle size={18} />
                    {state.error.code === 'TIMEOUT'
                      ? 'Verifiquemos qué pasó.'
                      : state.error.code === 'INSUFFICIENT_FUNDS'
                        ? 'No hay fondos suficientes.'
                        : 'Tu envío necesita otro intento.'}
                  </h3>
                  <p>{state.error.message}</p>
                  {uncertain && (
                    <p>
                      Conservamos la operación original. Al reintentar, verificamos su resultado
                      para evitar un cargo duplicado.
                    </p>
                  )}
                  <Button onClick={() => void confirm(scenario)}>
                    {state.error.code === 'TIMEOUT' ? 'Verificar resultado' : 'Reintentar envío'}
                    <ArrowRight size={16} />
                  </Button>
                </div>
              )}
              {busy && (
                <div className="pending-state" role="status">
                  <LoaderCircle className="spin-icon" size={21} />
                  <span>Procesando tu envío… Mantén esta pantalla abierta.</span>
                </div>
              )}
              {state.step !== 'error' && state.step !== 'success' && (
                <Button className="full-width" busy={busy} onClick={() => void confirm(scenario)}>
                  {busy ? 'Confirmando…' : 'Confirmar envío'}
                  {!busy && <ArrowRight size={17} />}
                </Button>
              )}
              {!busy && !uncertain && state.step !== 'success' && (
                <Button variant="ghost" className="full-width" onClick={edit}>
                  <ArrowLeft size={16} /> Editar datos
                </Button>
              )}
              <p className="transfer-note">
                <ShieldCheck size={13} /> Una operación, una confirmación.
              </p>
            </>
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
          onChange={(e) => setScenario(e.target.value as Scenario)}
        >
          {outcomes.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p>
          En modo aleatorio: 60% éxito y 10% por cada error. Timeout simula un cargo confirmado cuya
          respuesta se perdió. Reintentar recupera el comprobante original.
        </p>
      </DemoPanel>
    </>
  );
}
