import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Alegreya, PT_Sans } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from '@/context/theme-provider';
import { SidebarProvider } from '@/context/sidebar-context';
import { PWALifecycle } from '@/components/pwa-lifecycle';
import { FirebaseClientProvider } from '@/firebase';

const headlineFont = Alegreya({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-headline',
  display: 'swap',
});

const bodyFont = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
  display: 'swap',
});


export const metadata: Metadata = {
  title: 'CRApro95 - Gestión Agrícola Integral',
  description: 'Sistema Integral de Gestión Agrícola by Firebase Studio',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#F8F5EF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${headlineFont.variable} ${bodyFont.variable}`}>
        <ThemeProvider>
          <FirebaseClientProvider>
            <AuthProvider>
              <SidebarProvider>
                {children}
              </SidebarProvider>
              <Toaster />
            </AuthProvider>
          </FirebaseClientProvider>
        </ThemeProvider>
        <PWALifecycle />
      </body>
    </html>
  );
}
