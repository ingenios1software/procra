'use client';

import React, { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Usuario, Permisos, Rol, EmpresaSaaS } from '@/lib/types';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { getEstadoComercial, mergePermisosByGate, resolveModulosComprados } from '@/lib/suscripcion-saas';

interface AuthContextType {
  usuarioApp: Usuario | null;
  permisos: Permisos;
  isAuthLoading: boolean;
  role: string | null;
  empresa: EmpresaSaaS | null;
  estadoComercial: {
    acceso: boolean;
    esDemo: boolean;
    motivo: "sin_empresa" | "inactiva" | "demo_activo" | "suscripcion_activa" | "sin_suscripcion";
  };
  // setRole is no longer needed as role comes from Firestore
}

const defaultPermissions: Permisos = {
    compras: false, stock: false, eventos: false, monitoreos: false,
    ventas: false, contabilidad: false, rrhh: false,
    finanzas: false, agronomia: false, maestros: false, administracion: false,
};

const allPermissions: Permisos = {
    compras: true, stock: true, eventos: true, monitoreos: true,
    ventas: true, contabilidad: true, rrhh: true,
    finanzas: true, agronomia: true, maestros: true, administracion: true,
};


export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: isAuthLoading, userError } = useUser();
  const firestore = useFirestore();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  
  useEffect(() => {
    if (!isAuthLoading) {
      setAuthTimedOut(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setAuthTimedOut(true);
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [isAuthLoading]);
  
  // Fetch user profile from Firestore
  const userProfileRef = useMemoFirebase(() => 
    (firebaseUser && firestore) ? doc(firestore, 'usuarios', firebaseUser.uid) : null, 
    [firebaseUser, firestore]
  );
  const { data: usuarioApp, isLoading: isProfileLoading } = useDoc<Usuario>(userProfileRef);

  // Fetch role permissions from Firestore
  const roleRef = useMemoFirebase(() => 
    (usuarioApp && firestore) ? doc(firestore, 'roles', usuarioApp.rolId) : null,
    [usuarioApp, firestore]
  );
  const { data: userRole, isLoading: isRoleLoading } = useDoc<Rol>(roleRef);

  const empresaRef = useMemoFirebase(
    () => (usuarioApp?.empresaId && firestore ? doc(firestore, 'empresas', usuarioApp.empresaId) : null),
    [usuarioApp?.empresaId, firestore]
  );
  const { data: empresaSaaS, isLoading: isEmpresaLoading } = useDoc<EmpresaSaaS>(empresaRef);

  const isLoading = (isAuthLoading && !authTimedOut && !userError) || isProfileLoading || isRoleLoading || isEmpresaLoading;

  const value = useMemo(() => {
    // SPECIAL CASE: If the user has the 'admin' role, always grant all permissions.
    // This is a safeguard to ensure the admin is never locked out due to DB inconsistencies.
    const isAdmin = usuarioApp?.rolNombre === 'admin';
    const estadoComercial = getEstadoComercial(empresaSaaS || null);
    const permisosPorRol = isAdmin ? allPermissions : (userRole?.permisos || defaultPermissions);
    const modulosComprados = resolveModulosComprados(empresaSaaS || null);
    const gateComercial: Permisos = {
      compras: estadoComercial.acceso,
      stock: estadoComercial.acceso,
      eventos: estadoComercial.acceso,
      monitoreos: estadoComercial.acceso,
      ventas: estadoComercial.acceso,
      contabilidad: estadoComercial.acceso,
      rrhh: estadoComercial.acceso,
      finanzas: estadoComercial.acceso,
      agronomia: estadoComercial.acceso,
      maestros: estadoComercial.acceso,
      // Permitir administración para gestionar planes/módulos incluso con suscripción vencida.
      administracion: true,
    };
    const permisos = mergePermisosByGate(
      mergePermisosByGate(permisosPorRol, modulosComprados),
      gateComercial
    );

    return {
      isAuthLoading: isLoading,
      usuarioApp: isLoading ? null : (usuarioApp || null),
      permisos,
      role: usuarioApp?.rolNombre || null,
      empresa: empresaSaaS || null,
      estadoComercial,
    };
  }, [empresaSaaS, isLoading, usuarioApp, userRole]);


  if (isAuthLoading && !authTimedOut && !userError) { // Only show global loader during initial Firebase Auth check
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
            <p>Verificando autenticación...</p>
        </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

