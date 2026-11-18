import Link from 'next/link';
import { AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AppError } from '@/lib/errors';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/home" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Spin, inicio"><span className="brand-word">spin<span className="brand-dot">•</span></span><span className="brand-by">by <b>OXXO</b></span></Link>;
}
export function Button({ children, busy, variant = 'primary', className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button {...props} disabled={disabled || busy} className={`button button-${variant} ${className}`} aria-busy={busy || undefined}>{busy && <LoaderCircle size={18} className="spin-icon" aria-hidden="true" />}{children}</button>;
}
export function Avatar({ name, index = 0, small = false }: { name: string; index?: number; small?: boolean }) {
  return <span aria-hidden="true" className={`avatar avatar-${index % 4} ${small ? 'avatar-small' : ''}`}>{name.split(' ').slice(0, 2).map(x => x[0]).join('')}</span>;
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const expired = error instanceof AppError && error.code === 'UNAUTHORIZED';
  return <div className="error-state" role="alert"><AlertCircle size={22} aria-hidden="true" /><div><strong>{expired ? 'Vuelve a entrar a tu cuenta' : 'Algo no salió como esperábamos'}</strong><p>{error instanceof Error ? error.message : 'Intenta nuevamente en un momento.'}</p>{expired ? <Link href="/login" className="text-link">Ir al inicio de sesión <ArrowRight size={16} /></Link> : retry && <Button variant="secondary" onClick={retry}>Reintentar</Button>}</div></div>;
}
export function LoadingState({ label = 'Cargando tu cuenta…' }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin-icon" size={26} aria-hidden="true" /><span>{label}</span><div className="skeleton" /><div className="skeleton short" /></div>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>;
}
export function DemoPanel({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_DEMO_CONTROLS !== 'true') return null;
  return <details className="demo-panel"><summary>Laboratorio de la demo</summary><div>{children}</div></details>;
}
