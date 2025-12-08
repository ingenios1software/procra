import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from '@/context/theme-provider';
import { SidebarProvider } from '@/context/sidebar-context';
import { PWALifecycle } from '@/components/pwa-lifecycle';
import { FirebaseClientProvider } from '@/firebase';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:wght@400;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
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
