'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ConnectionStatusIndicator } from '@/components/shared/connection-status';
import { OperativoAssistant } from '@/components/assistant/operativo-assistant';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { canAccessPathByPermisos, getModuloLabelForPermission, getPermissionForPath } from '@/lib/route-permissions';
import { useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const startYear = 2024;
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;
  const { user, role, permisos, isAuthLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const lastDeniedLogKeyRef = useRef<string | null>(null);
  const hasPathAccess = canAccessPathByPermisos(pathname, permisos, role);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace('/login');
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (isAuthLoading || !user || hasPathAccess) return;

    const blockedPath = pathname || '/';
    const requiredPermission = getPermissionForPath(blockedPath);
    const modulo = getModuloLabelForPermission(requiredPermission);
    const logKey = `${user.id || user.email || 'unknown'}|${blockedPath}`;

    if (firestore && lastDeniedLogKeyRef.current !== logKey) {
      lastDeniedLogKeyRef.current = logKey;
      void addDoc(collection(firestore, 'auditoriaAsistente'), {
        prompt: `Intento acceso modulo ${modulo}`,
        promptNormalizado: `intento acceso ${blockedPath}`,
        intentType: 'modulo',
        term: modulo,
        status: 'forbidden',
        durationMs: 0,
        responsePreview: `Bloqueado por permisos en ruta ${blockedPath}`,
        source: 'route_guard',
        route: blockedPath,
        requiredPermission,
        user: {
          id: user.id || null,
          nombre: user.nombre || null,
          email: user.email || null,
          rol: role || null,
        },
        permisos: { ...permisos },
        createdAt: serverTimestamp(),
      }).catch((error) => {
        console.warn('No se pudo registrar acceso bloqueado:', error);
      });
    }

    if (pathname !== '/acceso-denegado') {
      router.replace(`/acceso-denegado?from=${encodeURIComponent(blockedPath)}`);
    }
  }, [firestore, hasPathAccess, isAuthLoading, pathname, permisos, role, router, user]);

  if (isAuthLoading) {
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

  if (!hasPathAccess) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <p>Sin acceso a este modulo. Redirigiendo...</p>
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
      <OperativoAssistant />
    </div>
  );
}

