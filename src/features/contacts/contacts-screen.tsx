'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowUpRight, Plus, Search, Users } from 'lucide-react';
import {
  Avatar,
  Button,
  ErrorState,
  LoadingState,
  PageHeading,
  QueryRefreshWarning,
} from '@/components/ui';
import { isSessionError } from '@/lib/errors';
import { useWallet } from '@/features/wallet/use-wallet';
import { ContactForm } from './contact-form';
export function ContactsScreen() {
  const { data, isPending, error, refetch } = useWallet();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState('');
  const addButton = useRef<HTMLButtonElement>(null);
  const sessionError = isSessionError(error);
  function closeForm() {
    setAdding(false);
    addButton.current?.focus();
  }
  const contacts = data?.contacts.filter((c) =>
    `${c.name} ${c.identity}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="CERCA, AUNQUE ESTÉN LEJOS"
        title="Tus personas favoritas."
        description="Guarda sus datos una vez. Comparte más momentos."
        action={
          <Button
            ref={addButton}
            disabled={!data || sessionError}
            onClick={() => {
              setAdding(true);
              setSaved('');
            }}
          >
            <Plus size={19} /> Nuevo contacto
          </Button>
        }
      />
      {saved && (
        <p className="success-banner" role="status">
          {saved} se agregó a tus contactos.
        </p>
      )}
      {adding && data && !sessionError && (
        <div className="panel contact-form-panel">
          <ContactForm
            walletId={data.id}
            onSaved={(c) => {
              setSaved(c.name);
              closeForm();
            }}
            onCancel={closeForm}
          />
        </div>
      )}
      {isPending ? (
        <LoadingState label="Cargando tus contactos…" />
      ) : error && (!data || sessionError) ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : (
        <>
          {error && <QueryRefreshWarning error={error} retry={() => void refetch()} />}
          <section className="panel contacts-panel">
            <div className="search-field">
              <Search size={20} aria-hidden="true" />
              <label htmlFor="contact-search" className="sr-only">
                Buscar contactos
              </label>
              <input
                id="contact-search"
                placeholder="Buscar por nombre, teléfono o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="contacts-grid">
              {contacts?.map((c, index) => (
                <article className="contact-card" key={c.id}>
                  <Avatar name={c.name} index={index} />
                  <h2>{c.name}</h2>
                  <p>{c.identity}</p>
                  <Link
                    href={`/transfer?to=${encodeURIComponent(c.id)}`}
                    className="button button-secondary"
                  >
                    Enviar dinero <ArrowUpRight size={17} />
                  </Link>
                </article>
              ))}
            </div>
            {!contacts?.length && (
              <div className="empty-state">
                <Users size={28} />
                <h3>No encontramos contactos</h3>
                <p>Prueba otro nombre o agrega una nueva persona.</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
