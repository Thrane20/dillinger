import type { Metadata } from 'next';
import { Anybody, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ClientProviders from './components/ClientProviders';
import WorkbenchShell from './components/WorkbenchShell';

const anybody = Anybody({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dillinger - Game Library Manager',
  description: 'Manage and play games across multiple platforms with containerized execution',
  keywords: ['games', 'library', 'manager', 'docker', 'streaming', 'cross-platform'],
  authors: [{ name: 'Dillinger Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${anybody.variable} ${jetBrainsMono.variable} font-sans antialiased`}>
        <ClientProviders>
          <WorkbenchShell>{children}</WorkbenchShell>
        </ClientProviders>
      </body>
    </html>
  );
}
