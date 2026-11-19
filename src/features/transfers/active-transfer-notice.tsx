'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { isUncertain, useTransfer } from './use-transfer';

export function ActiveTransferNotice() {
  const pathname = usePathname();
  const { ready, state, draft, startNew } = useTransfer();
  if (!ready || pathname === '/transfer') return null;
  const hasDraft = !!(draft.amount || draft.recipientId || draft.concept);
  if (state.step === 'editing' && !hasDraft) return null;
  if (state.step === 'success') {
    if (pathname === `/receipt/${state.receiptId}`) return null;
    return (
      <aside className="active-transfer-notice" role="status">
        <div>
          <strong>Tu envío se confirmó.</strong>
          <p>Tu comprobante está disponible.</p>
        </div>
        <Link className="text-link" href={`/receipt/${state.receiptId}`}>
          Ver comprobante <ArrowRight size={16} />
        </Link>
        <Link href="/transfer" className="text-link" onClick={startNew}>
          Hacer otro envío
        </Link>
      </aside>
    );
  }
  const busy = state.step === 'submitting' || state.step === 'verifying';
  const uncertain = isUncertain(state);
  return (
    <aside className="active-transfer-notice" role="status">
      <div>
        <strong>
          {busy
            ? 'Tu envío está en proceso.'
            : uncertain
              ? 'Tu envío tiene un resultado pendiente.'
              : 'Tienes un envío por terminar.'}
        </strong>
        <p>
          {busy
            ? 'Puedes seguir aquí; el resultado aparecerá en este aviso.'
            : uncertain
              ? 'Consulta el resultado antes de iniciar otro envío.'
              : 'Conservamos tus datos para que puedas continuar.'}
        </p>
      </div>
      <Link className="text-link" href="/transfer">
        {uncertain ? 'Revisar envío pendiente' : 'Continuar envío'} <ArrowRight size={16} />
      </Link>
    </aside>
  );
}
