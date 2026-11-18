'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { ArrowRight, ArrowUpRight, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { loginSchema } from '@/lib/contracts';
import { api } from '@/lib/api';
import { announceAuthChange } from '@/lib/auth-events';
import { Brand, Button, ErrorState } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [identity, setIdentity] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const result = loginSchema.safeParse({ identity });
    setError(null);
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      inputRef.current?.focus();
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      await api(
        '/api/session',
        z.object({ user: z.object({ name: z.string(), identity: z.string() }) }),
        { method: 'POST', body: JSON.stringify(result.data) },
      );
      announceAuthChange();
      router.replace('/home');
      router.refresh();
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand light />
        <div className="login-story-content">
          <span className="story-badge">
            <Sparkles size={15} /> UNA NUEVA FORMA DE MOVERTE
          </span>
          <h1>
            Tu dinero.
            <br />
            Tus planes.
            <br />
            <span>Tu siguiente spin.</span>
          </h1>
          <p>
            Haz espacio para lo que importa.
            <br />
            Tu dinero se mueve contigo.
          </p>
          <div className="wallet-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-card">
              <span className="art-card-brand">
                spin<span>•</span>
              </span>
              <span className="art-card-chip">
                <Wallet size={30} />
              </span>
              <div>
                <small>TU MUNDO, EN MOVIMIENTO</small>
                <strong>Un giro a tu día.</strong>
              </div>
              <ArrowUpRight className="art-card-arrow" size={42} />
            </div>
            <div className="art-notification">
              <span>
                <ArrowUpRight size={23} />
              </span>
              <div>
                <strong>Para tus mejores planes</strong>
                <small>Enviar dinero se siente así de fácil.</small>
              </div>
            </div>
          </div>
        </div>
        <p className="login-story-footer">Hecho para acompañarte, todos los días.</p>
      </section>
      <section className="login-form-section">
        <div className="login-top">
          <span className="demo-badge">Experiencia demo</span>
          <span>Mini Wallet / 01</span>
        </div>
        <div className="login-form-wrap">
          <span className="login-icon">
            <Wallet size={28} />
          </span>
          <p className="eyebrow">QUÉ BUENO TENERTE AQUÍ</p>
          <h2>Hola, de nuevo.</h2>
          <p className="muted login-description">
            Entra a tu wallet y dale movimiento a tus planes.
          </p>
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="identity">Teléfono o correo electrónico</label>
              <input
                ref={inputRef}
                id="identity"
                name="identity"
                type="text"
                autoComplete="username"
                placeholder="Ej. alex@demo.mx"
                value={identity}
                disabled={busy}
                maxLength={120}
                onChange={(event) => {
                  setIdentity(event.target.value);
                  setFieldError('');
                }}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? 'identity-error' : 'identity-hint'}
              />
              {fieldError ? (
                <p className="field-error" id="identity-error" role="alert">
                  {fieldError}
                </p>
              ) : (
                <p className="field-hint" id="identity-hint">
                  Usa un teléfono de 10 dígitos o un correo válido.
                </p>
              )}
            </div>
            {error !== null && <ErrorState error={error} />}
            <Button type="submit" busy={busy} className="full-width">
              {busy ? 'Entrando…' : 'Entrar a mi wallet'}
              {!busy && <ArrowRight size={18} />}
            </Button>
          </form>
          <div className="login-demo">
            <span className="tiny-label">SOLO ESTÁS A UN PASO</span>
            <p>
              Explora con una cuenta de prueba.
              <br />
              No necesitas datos personales ni contraseña.
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setIdentity('alex@demo.mx');
                setFieldError('');
                inputRef.current?.focus();
              }}
            >
              Usar cuenta de prueba <ArrowUpRight size={17} />
            </Button>
          </div>
          <details className="login-help">
            <summary>¿Cómo funciona esta demo?</summary>
            <p>
              Todos los datos y movimientos son ficticios. Para probar un error de inicio de sesión,
              usa <code>error@demo.mx</code>. Cualquier otro correo válido o teléfono de 10 dígitos
              permite entrar.
            </p>
          </details>
        </div>
        <footer className="login-footer">
          <ShieldCheck size={16} /> Simulación educativa. No se mueve dinero real.
        </footer>
      </section>
    </div>
  );
}
