'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contactInputSchema, contactSchema, type Contact } from '@/lib/contracts';
import { api } from '@/lib/api';
import { Button, ErrorState } from '@/components/ui';
export function ContactForm({
  onSaved,
  onCancel,
  walletId,
}: {
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
  walletId: string;
}) {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const identityInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || activeRequest.current) return;
    const result = contactInputSchema.safeParse({ name, identity });
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message])));
      const firstInvalid = result.error.issues[0]?.path[0];
      (firstInvalid === 'name' ? nameInput : identityInput).current?.focus();
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const contact = await api('/api/contacts', contactSchema, {
        method: 'POST',
        body: JSON.stringify({ ...result.data, walletId }),
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return;
      await client.invalidateQueries({ queryKey: ['wallet'] });
      if (!mounted.current || controller.signal.aborted) return;
      onSaved(contact);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        setError(error);
        setBusy(false);
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="contact-form-heading">
        <h3>Una persona más cerca</h3>
        <p>Guarda un contacto para tus próximos envíos.</p>
      </div>
      <div className="field">
        <label htmlFor="contact-name">Nombre del contacto</label>
        <input
          id="contact-name"
          ref={nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="off"
          disabled={busy}
          autoFocus
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
          placeholder="Ej. Mariana Torres"
        />
        {errors.name && (
          <p role="alert" className="field-error" id="contact-name-error">
            {errors.name}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="contact-identity">Teléfono o correo del contacto</label>
        <input
          id="contact-identity"
          ref={identityInput}
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          maxLength={120}
          autoComplete="off"
          disabled={busy}
          aria-invalid={!!errors.identity}
          aria-describedby={errors.identity ? 'contact-identity-error' : undefined}
          placeholder="Ej. 5512345678"
        />
        {errors.identity && (
          <p role="alert" className="field-error" id="contact-identity-error">
            {errors.identity}
          </p>
        )}
      </div>
      {error !== null && <ErrorState error={error} />}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" busy={busy}>
          Guardar contacto
        </Button>
      </div>
    </form>
  );
}
