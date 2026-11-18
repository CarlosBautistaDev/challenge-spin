'use client';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contactInputSchema, contactSchema, type Contact } from '@/lib/contracts';
import { api } from '@/lib/api';
import { Button, ErrorState } from '@/components/ui';
export function ContactForm({ onSaved, onCancel }: { onSaved: (contact: Contact) => void; onCancel: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = contactInputSchema.safeParse({ name, identity });
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map(i => [String(i.path[0]), i.message]))); return; }
    setErrors({}); setError(null); setBusy(true);
    try {
      const contact = await api('/api/contacts', contactSchema, { method: 'POST', body: JSON.stringify(result.data) });
      await client.invalidateQueries({ queryKey: ['wallet'] });
      onSaved(contact);
    } catch (error) { setError(error); setBusy(false); }
  }
  return <form className="contact-form" onSubmit={submit} noValidate><div className="contact-form-heading"><h3>Una persona más cerca</h3><p>Guarda un contacto para tus próximos envíos.</p></div><div className="field"><label htmlFor="contact-name">Nombre del contacto</label><input id="contact-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="off" disabled={busy} autoFocus aria-invalid={!!errors.name} aria-describedby={errors.name ? 'contact-name-error' : undefined} placeholder="Ej. Mariana Torres" />{errors.name && <p role="alert" className="field-error" id="contact-name-error">{errors.name}</p>}</div><div className="field"><label htmlFor="contact-identity">Teléfono o correo del contacto</label><input id="contact-identity" value={identity} onChange={e => setIdentity(e.target.value)} maxLength={120} autoComplete="off" disabled={busy} aria-invalid={!!errors.identity} aria-describedby={errors.identity ? 'contact-identity-error' : undefined} placeholder="Ej. 5512345678" />{errors.identity && <p role="alert" className="field-error" id="contact-identity-error">{errors.identity}</p>}</div>{error !== null && <ErrorState error={error} />}<div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button><Button type="submit" busy={busy}>Guardar contacto</Button></div></form>;
}
