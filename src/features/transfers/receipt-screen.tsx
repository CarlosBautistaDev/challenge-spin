'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Check, Printer, ShieldCheck } from 'lucide-react';
import { Avatar, Button, ErrorState, LoadingState, QueryRefreshWarning } from '@/components/ui';
import { useWalletSession } from '@/features/auth/wallet-session';
import { api } from '@/lib/api';
import { receiptSchema } from '@/lib/contracts';
import { formatMoney } from '@/lib/money';
import { formatWalletDate } from '@/lib/date';
import { isSessionError } from '@/lib/errors';
import { useTransfer } from './use-transfer';
export function ReceiptScreen({ id }: { id: string }) {
  const { walletId } = useWalletSession();
  const { startNew } = useTransfer();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['receipt', walletId, id],
    queryFn: ({ signal }) =>
      api(`/api/transfers/${encodeURIComponent(id)}`, receiptSchema, { signal }),
    staleTime: Infinity,
    retry: false,
  });
  return (
    <div className="receipt-wrap">
      <Link href="/home" className="back-link">
        <ArrowLeft size={15} /> Volver a mi wallet
      </Link>
      {isPending ? (
        <LoadingState label="Buscando tu comprobante…" />
      ) : error && (!data || isSessionError(error)) ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : (
        data && (
          <>
            {error && <QueryRefreshWarning error={error} retry={() => void refetch()} />}
            <article className="panel receipt-panel">
              <header className="receipt-heading">
                <span className="success-icon">
                  <Check size={30} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <h1>¡Envío completado!</h1>
                <p>Un buen momento, en camino.</p>
                <div className="review-amount">{formatMoney(data.amountCents)}</div>
                <span className="receipt-status">Transferencia exitosa · MXN</span>
              </header>
              <div className="review-recipient">
                <Avatar name={data.recipient.name} />
                <div>
                  <strong>{data.recipient.name}</strong>
                  <p>{data.recipient.identity}</p>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Desde</dt>
                  <dd>Mi wallet · {data.sender.name}</dd>
                </div>
                <div>
                  <dt>Concepto</dt>
                  <dd>{data.concept || 'Sin concepto'}</dd>
                </div>
                <div>
                  <dt>Fecha y hora</dt>
                  <dd>
                    <time dateTime={data.createdAt}>
                      {formatWalletDate(data.createdAt, 'receipt')}
                    </time>
                    <br />
                    <small>Ciudad de México</small>
                  </dd>
                </div>
                <div>
                  <dt>Referencia</dt>
                  <dd>{data.reference}</dd>
                </div>
                <div>
                  <dt>Comisión</dt>
                  <dd>{formatMoney(0)}</dd>
                </div>
                <div className="total">
                  <dt>Total enviado</dt>
                  <dd>{formatMoney(data.amountCents)}</dd>
                </div>
              </dl>
              <p className="receipt-demo-note">
                Comprobante de simulación. Sin validez bancaria.
                <br />
                No se realizó una transferencia de dinero real.
              </p>
            </article>
            <div className="receipt-actions">
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer size={18} /> Guardar comprobante
              </Button>
              <Link href="/transfer" className="button button-primary" onClick={startNew}>
                Hacer otro envío <ArrowUpRight size={18} />
              </Link>
            </div>
            <span className="receipt-bottom muted">
              <small>
                <ShieldCheck size={13} /> También lo encontrarás en tus movimientos.
              </small>
            </span>
          </>
        )
      )}
    </div>
  );
}
