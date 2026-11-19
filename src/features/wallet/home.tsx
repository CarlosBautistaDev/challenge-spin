'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Coffee,
  Eye,
  EyeOff,
  Plus,
  ShoppingBag,
  Sparkles,
  Wallet,
  Check,
} from 'lucide-react';
import {
  Avatar,
  Button,
  DemoPanel,
  ErrorState,
  LoadingState,
  PageHeading,
  QueryRefreshWarning,
} from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatWalletDate } from '@/lib/date';
import { isSessionError } from '@/lib/errors';
import type { Movement } from '@/lib/contracts';
import { useWallet } from './use-wallet';

function MovementRow({ movement }: { movement: Movement }) {
  const incoming = movement.kind === 'incoming';
  const Icon = incoming
    ? ArrowDownLeft
    : movement.kind === 'outgoing'
      ? ArrowUpRight
      : movement.title.includes('Café')
        ? Coffee
        : ShoppingBag;
  const content = (
    <>
      <span className={`movement-icon ${incoming ? 'incoming' : ''}`}>
        <Icon size={21} aria-hidden="true" />
      </span>
      <div className="movement-info">
        <strong>{movement.title}</strong>
        <span>{movement.subtitle}</span>
      </div>
      <div className="movement-amount">
        <strong className={incoming ? 'positive' : ''}>
          {incoming ? '+' : '−'}
          {formatMoney(movement.amountCents)}
        </strong>
        <time dateTime={movement.createdAt}>
          {formatWalletDate(movement.createdAt, 'movement')}
        </time>
      </div>
      {movement.receiptId && <ArrowUpRight size={16} aria-hidden="true" className="muted" />}
    </>
  );
  return (
    <li>
      {movement.receiptId ? (
        <Link className="movement-row movement-link" href={`/receipt/${movement.receiptId}`}>
          {content}
        </Link>
      ) : (
        <div className="movement-row">{content}</div>
      )}
    </li>
  );
}
export function HomeScreen() {
  const [state, setState] = useState('normal');
  const [hidden, setHidden] = useState(false);
  const { data, error, isPending, refetch, isFetching } = useWallet(state);
  return (
    <>
      <PageHeading
        eyebrow="TU DÍA EMPIEZA AQUÍ"
        title={`Hola${data ? `, ${data.user.name.split(' ')[0]}` : ''}. Dale un giro a tu día.`}
        description="Todo lo que necesitas, en un solo lugar."
        action={
          <span className="account-pill">
            <span /> Cuenta activa
          </span>
        }
      />
      {isPending ? (
        <LoadingState />
      ) : error && (!data || isSessionError(error)) ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : (
        data && (
          <>
            {error && <QueryRefreshWarning error={error} retry={() => void refetch()} />}
            <div className="overview-grid">
              <section className="balance-card" aria-label="Saldo de tu wallet">
                <div className="balance-top">
                  <span>
                    <Wallet size={19} /> Saldo disponible
                  </span>
                  <button
                    className="balance-visibility"
                    onClick={() => setHidden(!hidden)}
                    aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
                  >
                    {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="balance-value">
                  {hidden ? '••••••' : formatMoney(data.balanceCents)}
                  <span>MXN</span>
                </div>
                <p>Listo para lo que viene.</p>
                <div className="balance-actions">
                  <Link className="button button-orange" href="/transfer">
                    <ArrowUpRight size={20} /> Enviar dinero
                  </Link>
                  <a href="#movimientos" className="balance-link">
                    Ver movimientos <ArrowRight size={17} />
                  </a>
                </div>
                <div className="balance-decoration" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </section>
              <section className="daily-card">
                <div className="daily-heading">
                  <span className="daily-icon">
                    <Sparkles size={19} />
                  </span>
                  <span>PARA LO QUE IMPORTA</span>
                </div>
                <h2>
                  Menos vueltas.
                  <br />
                  Más momentos.
                </h2>
                <p>
                  Comparte una comida, un plan
                  <br className="desktop-only" /> o una buena noticia.
                </p>
                <Link href="/transfer">
                  Hazlo con un envío <ArrowUpRight size={17} />
                </Link>
                <div className="daily-decoration" aria-hidden="true">
                  <div>↗</div>
                </div>
              </section>
            </div>
            <div className="home-lower">
              <section className="panel movements-panel" id="movimientos">
                <div className="panel-heading">
                  <div>
                    <h2>Tu actividad reciente</h2>
                    <p>Los últimos movimientos de tu cuenta.</p>
                  </div>
                  <span className="count-badge">{data.movements.length}</span>
                </div>
                {data.movements.length ? (
                  <ul className="movements-list">
                    {data.movements.slice(0, 8).map((m) => (
                      <MovementRow key={m.id} movement={m} />
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <ArrowUpRight size={28} />
                    </span>
                    <h3>Tu próximo movimiento empieza aquí</h3>
                    <p>Cuando envíes dinero, lo encontrarás en esta sección.</p>
                    <Link href="/transfer" className="text-link">
                      Hacer mi primer envío <ArrowRight size={16} />
                    </Link>
                  </div>
                )}
                {data.movements.length > 8 && (
                  <p className="panel-footnote">Mostrando los 8 movimientos más recientes.</p>
                )}
                <div className="activity-note">
                  <Check size={15} /> Tus movimientos, siempre a la mano.
                </div>
              </section>
              <div className="home-right">
                <section className="panel favorites-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Tus personas</h2>
                      <p>Un envío, y estás más cerca.</p>
                    </div>
                    <Link
                      className="icon-button"
                      href="/contacts"
                      aria-label="Ver y agregar contactos"
                    >
                      <Plus size={20} />
                    </Link>
                  </div>
                  <div className="favorite-grid">
                    {data.contacts.slice(0, 4).map((c, i) => (
                      <Link
                        className="favorite-contact"
                        key={c.id}
                        href={`/transfer?to=${encodeURIComponent(c.id)}`}
                      >
                        <Avatar name={c.name} index={i} />
                        <strong>{c.name.split(' ')[0]}</strong>
                        <span>
                          Enviar <ArrowUpRight size={12} />
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link href="/contacts" className="favorites-link">
                    Ver todos mis contactos <ArrowRight size={16} />
                  </Link>
                </section>
                <section className="tip-card">
                  <span className="tip-mark">i</span>
                  <div>
                    <strong>Pequeño hábito, gran diferencia.</strong>
                    <p>Revisa el destinatario y el monto antes de confirmar cada envío.</p>
                  </div>
                </section>
              </div>
            </div>
          </>
        )
      )}
      <DemoPanel>
        <label htmlFor="home-state">Estado del Home</label>
        <select id="home-state" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="normal">Normal</option>
          <option value="empty">Sin movimientos</option>
          <option value="error">Error de servicio</option>
        </select>
        <Button variant="secondary" busy={isFetching} onClick={() => void refetch()}>
          Recargar datos
        </Button>
        <p>Estos controles solo cambian la respuesta de demostración; no borran movimientos.</p>
      </DemoPanel>
    </>
  );
}
