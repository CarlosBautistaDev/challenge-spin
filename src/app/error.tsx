'use client';
import { ErrorState } from '@/components/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <ErrorState
        error={new Error('No pudimos mostrar esta pantalla. Tus datos siguen en tu sesión.')}
        retry={reset}
      />
    </main>
  );
}
