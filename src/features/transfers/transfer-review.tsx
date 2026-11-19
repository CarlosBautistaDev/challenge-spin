'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { Scenario, Wallet } from '@/lib/contracts';
import { isUncertain, useTransfer } from './use-transfer';

export function TransferReview({
  wallet,
  scenario,
  onEdit,
}: {
  wallet: Wallet;
  scenario: Scenario;
  onEdit: () => void;
}) {
  const { state, confirm, verify, startNew } = useTransfer();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.step === 'review' || state.step === 'error' || state.step === 'success')
      headingRef.current?.focus();
  }, [state.step]);
  if (state.step === 'editing') return null;
  if (state.step === 'success')
    return (
      <div className="review-heading">
        <h2 ref={headingRef} tabIndex={-1}>
          Tu envío está confirmado.
        </h2>
        <p>El comprobante está listo para consultar.</p>
        <Link href={`/receipt/${state.receiptId}`} className="button button-primary">
          Ver comprobante <ArrowRight size={17} />
        </Link>
        <Button variant="ghost" className="full-width" onClick={startNew}>
          Hacer otro envío
        </Button>
      </div>
    );
  const recipient = wallet.contacts.find((contact) => contact.id === state.input.recipientId);
  const uncertain = isUncertain(state);
  const busy = state.step === 'submitting' || state.step === 'verifying';
  return (
    <>
      <div className="review-heading">
        <h2 tabIndex={-1} ref={headingRef}>
          Todo listo para tu envío.
        </h2>
        <p>Un último vistazo antes de confirmar.</p>
        <div className="review-amount">{formatMoney(state.input.amountCents)}</div>
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
      <dl className="detail-list">
        <div>
          <dt>Desde</dt>
          <dd>Mi wallet · MXN</dd>
        </div>
        <div>
          <dt>Concepto</dt>
          <dd>{state.input.concept || 'Sin concepto'}</dd>
        </div>
        <div>
          <dt>Comisión</dt>
          <dd>{formatMoney(0)}</dd>
        </div>
        <div className="total">
          <dt>Total a enviar</dt>
          <dd>{formatMoney(state.input.amountCents)}</dd>
        </div>
      </dl>
      {state.step === 'review' && (
        <p className="review-warning">
          Comprueba que el destinatario y el monto sean correctos antes de continuar.
        </p>
      )}
      {state.step === 'error' && (
        <div className="transfer-error" role="alert">
          <h3>
            <AlertCircle size={18} />
            {uncertain
              ? 'Verifiquemos qué pasó.'
              : state.error.code === 'INSUFFICIENT_FUNDS'
                ? 'No hay fondos suficientes.'
                : 'Tu envío necesita otro intento.'}
          </h3>
          <p>{state.error.message}</p>
          {state.error.requestId && <small>Referencia de ayuda: {state.error.requestId}</small>}
          {uncertain ? (
            <>
              <p>
                Consultar el resultado no envía dinero. Conservamos los datos y la clave de tu envío
                original.
              </p>
              <Button onClick={() => void verify()}>
                Verificar resultado <ArrowRight size={16} />
              </Button>
              {state.lookup === 'unknown' && (
                <>
                  <p>
                    Puedes consultar de nuevo o reintentar el mismo envío. El reintento puede
                    completar la operación si aún no se procesó; usa la misma clave para evitar un
                    cargo duplicado.
                  </p>
                  <Button variant="secondary" onClick={() => void confirm(scenario)}>
                    Reintentar mismo envío <ArrowRight size={16} />
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button onClick={() => void confirm(scenario)}>
              Reintentar envío <ArrowRight size={16} />
            </Button>
          )}
        </div>
      )}
      {busy && (
        <div className="pending-state" role="status">
          <LoaderCircle className="spin-icon" size={21} />
          <span>
            {state.step === 'verifying'
              ? 'Consultando el resultado de tu envío…'
              : 'Procesando tu envío… Puedes volver a Inicio mientras se confirma.'}
          </span>
        </div>
      )}
      {(state.step === 'review' || state.step === 'submitting') && (
        <Button className="full-width" busy={busy} onClick={() => void confirm(scenario)}>
          {busy ? 'Confirmando…' : 'Confirmar envío'}
          {!busy && <ArrowRight size={17} />}
        </Button>
      )}
      {!busy && !uncertain && (
        <Button variant="ghost" className="full-width" onClick={onEdit}>
          <ArrowLeft size={16} /> Editar datos
        </Button>
      )}
      <p className="transfer-note">
        <ShieldCheck size={13} /> Una operación, una confirmación.
      </p>
    </>
  );
}
