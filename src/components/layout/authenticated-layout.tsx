'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ConnectionStatusIndicator } from '@/components/shared/connection-status';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth, router]);

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <p>Cargando y autenticando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-screen-2xl">{children}</div>
        </main>
      </div>
      <ConnectionStatusIndicator />
    </div>
  );
}
