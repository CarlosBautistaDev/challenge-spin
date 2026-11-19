'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { ArrowUpRight, Home, Users, LogOut, ShieldCheck, ArrowRight, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import {
  announceAuthChange,
  clearPendingTransfers,
  invalidateClientSession,
} from '@/lib/auth-events';
import { AppError } from '@/lib/errors';
import { useWalletSession } from '@/features/auth/wallet-session';
import { ActiveTransferNotice } from '@/features/transfers/active-transfer-notice';
import { Avatar, Brand, Button, ErrorState } from './ui';

const navigation = [
  { href: '/home', label: 'Inicio', icon: Home },
  { href: '/transfer', label: 'Enviar dinero', icon: ArrowUpRight },
  { href: '/contacts', label: 'Contactos', icon: Users },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useWalletSession();
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/session', z.object({ ok: z.boolean() }), { method: 'DELETE' });
      invalidateClientSession(new AppError('UNAUTHORIZED', 'Has cerrado tu sesión.', 401));
      client.clear();
      clearPendingTransfers();
      announceAuthChange();
      router.replace('/login');
      router.refresh();
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">MI CUENTA</div>
        <nav aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={`nav-item ${pathname === href ? 'active' : ''}`}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{label}</span>
              {pathname === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Wallet size={22} />
            </span>
            <strong>Más para tu día a día.</strong>
            <p>Tu dinero y tus personas favoritas, en un solo lugar.</p>
            <Link href="/transfer">
              Haz tu primer envío <ArrowRight size={16} />
            </Link>
          </div>
          <Button
            aria-label="Cerrar sesión"
            variant="ghost"
            onClick={logout}
            busy={busy}
            className="logout"
          >
            <LogOut size={19} aria-hidden="true" />
            <span>Cerrar sesión</span>
          </Button>
          <span className="sidebar-foot">Mini Wallet · Experiencia demo</span>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-icon">
              <Wallet size={19} />
            </span>
            Mi wallet <span className="header-divider" />
            <span className="demo-badge">Demo</span>
          </div>
          <div className="profile">
            <div>
              <strong>{user.name}</strong>
              <span>Cuenta personal</span>
            </div>
            <Avatar name={user.name} small />
          </div>
        </header>
        <main id="main" className="main-content">
          {error !== null && <ErrorState error={error} retry={logout} />}
          <ActiveTransferNotice />
          {children}
          <footer className="main-footer">
            <span>
              <ShieldCheck size={15} aria-hidden="true" /> Tú tienes el control de tu dinero.
            </span>
            <span>Simulación · Sin dinero real</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
