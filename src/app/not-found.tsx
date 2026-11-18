import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <p className="eyebrow">404 · NOS SALIMOS DEL CAMINO</p>
      <h1>Esta página no está aquí.</h1>
      <p>Vuelve a tu wallet para continuar.</p>
      <Link className="button button-primary" href="/home">
        Ir a mi wallet
      </Link>
    </main>
  );
}
