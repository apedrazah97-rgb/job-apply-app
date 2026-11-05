import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Apply Assistant — Andrea Pedraza Herrera',
  description: 'Generador de aplicaciones de empleo personalizado',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
