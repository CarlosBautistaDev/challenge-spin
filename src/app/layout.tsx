import type { Metadata } from 'next';
import '@fontsource-variable/montserrat';
import '@fontsource-variable/open-sans';
import './globals.css';
import { Providers } from '@/components/providers';
export const metadata: Metadata = {
  title: { default: 'Spin · Mini Wallet', template: '%s · Spin Wallet' },
  description: 'Una experiencia demo para enviar dinero y consultar tu wallet.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
