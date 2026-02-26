'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ConnectionStatusIndicator } from '@/components/shared/connection-status';
import { useUser } from '@/firebase';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const startYear = 2024;
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <p>Cargando y autenticando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <p>Redirigiendo al inicio de sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar />
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-screen-2xl">{children}</div>
          </main>
        </div>
        <footer className="text-center text-xs text-muted-foreground p-4 border-t">
          © {copyrightYears} CRApro95 - Creado por Ricardo Ortellado. Todos los derechos reservados.
        </footer>
      </div>
      <ConnectionStatusIndicator />
    </div>
  );
}

