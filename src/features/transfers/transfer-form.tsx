'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Plus } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { ContactForm } from '@/features/contacts/contact-form';
import { formatMoney, parseMoney } from '@/lib/money';
import type { Wallet } from '@/lib/contracts';
import { useTransfer } from './use-transfer';

export function TransferForm({
  wallet,
  initialRecipient,
  focusAmount,
}: {
  wallet: Wallet;
  initialRecipient: string;
  focusAmount: boolean;
}) {
  const { ready, draft, updateDraft, review } = useTransfer();
  const [adding, setAdding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const contactTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRecipient = useRef<string | null>(null);
  useEffect(() => {
    if (
      ready &&
      !draft.recipientId &&
      wallet.contacts.some((contact) => contact.id === initialRecipient)
    )
      updateDraft({ recipientId: initialRecipient });
  }, [ready, draft.recipientId, wallet.contacts, initialRecipient, updateDraft]);
  useEffect(() => {
    if (!adding && pendingFocusRecipient.current) {
      const radio = Array.from(
        formRef.current?.querySelectorAll<HTMLInputElement>('input[name="recipient"]') ?? [],
      ).find((element) => element.value === pendingFocusRecipient.current);
      if (radio) {
        radio.focus();
        pendingFocusRecipient.current = null;
      }
    }
  });
  function prepare(event: FormEvent) {
    event.preventDefault();
    if (adding || !ready) return;
    const cents = parseMoney(draft.amount);
    const next: Record<string, string> = {};
    if (!wallet.contacts.some((contact) => contact.id === draft.recipientId))
      next.recipient = 'Elige una persona para tu envío.';
    if (cents === null || cents <= 0)
      next.amount = 'Escribe un monto mayor a $0, con hasta 2 decimales.';
    else if (cents > wallet.balanceCents) next.amount = 'El monto supera tu saldo disponible.';
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.recipient)
        formRef.current?.querySelector<HTMLInputElement>('input[name="recipient"]')?.focus();
      else amountRef.current?.focus();
      return;
    }
    review({
      walletId: wallet.id,
      amountCents: cents!,
      recipientId: draft.recipientId,
      concept: draft.concept.trim(),
    });
  }
  return (
    <>
      <div className="transfer-section-title">
        <h2>¿A quién le enviamos?</h2>
        <button
          ref={contactTriggerRef}
          type="button"
          className="button button-ghost"
          onClick={() => setAdding(!adding)}
          aria-expanded={adding}
          disabled={!ready}
        >
          <Plus size={16} /> Nuevo contacto
        </button>
      </div>
      {adding && (
        <ContactForm
          walletId={wallet.id}
          onSaved={(contact) => {
            updateDraft({ recipientId: contact.id });
            setAdding(false);
            setErrors({});
            pendingFocusRecipient.current = contact.id;
          }}
          onCancel={() => {
            setAdding(false);
            contactTriggerRef.current?.focus();
          }}
        />
      )}
      <form ref={formRef} onSubmit={prepare} noValidate>
        <fieldset
          className="recipient-options"
          disabled={!ready}
          aria-describedby={errors.recipient ? 'recipient-error' : undefined}
        >
          <legend className="sr-only">Selecciona un destinatario</legend>
          {wallet.contacts.map((contact, index) => (
            <label
              key={contact.id}
              className={`recipient-option ${draft.recipientId === contact.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="recipient"
                value={contact.id}
                checked={draft.recipientId === contact.id}
                onChange={() => {
                  updateDraft({ recipientId: contact.id });
                  setErrors((current) => ({ ...current, recipient: '' }));
                }}
              />
              <Avatar name={contact.name} index={index} />
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
              autoFocus={focusAmount}
              placeholder="0.00"
              value={draft.amount}
              maxLength={16}
              disabled={!ready}
              onChange={(event) => {
                updateDraft({ amount: event.target.value });
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
              Disponible: {formatMoney(wallet.balanceCents)} MXN · Sin comisión en esta demo.
            </p>
          )}
          <div className="amount-presets">
            {[100, 500, 1000].map((value) => (
              <button
                type="button"
                key={value}
                disabled={!ready}
                onClick={() => {
                  updateDraft({ amount: String(value) });
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
            <span>Opcional · {draft.concept.length}/80</span>
          </div>
          <input
            id="concept"
            value={draft.concept}
            onChange={(event) => updateDraft({ concept: event.target.value })}
            maxLength={80}
            disabled={!ready}
            placeholder="Ej. Para la cena del viernes"
          />
        </div>
        <Button type="submit" className="full-width" disabled={adding || !ready}>
          Revisar envío <ArrowRight size={17} />
        </Button>
        <p className="transfer-note">
          <LockKeyhole size={13} /> Aún no se descontará dinero de tu saldo.
        </p>
      </form>
    </>
  );
}
