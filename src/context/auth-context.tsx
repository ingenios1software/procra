'use client';

import React, { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Usuario, Permisos, Rol } from '@/lib/types';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface AuthContextType {
  usuarioApp: Usuario | null;
  permisos: Permisos;
  isAuthLoading: boolean;
  role: string | null;
  // setRole is no longer needed as role comes from Firestore
}

const defaultPermissions: Permisos = {
    compras: false, stock: false, eventos: false, monitoreos: false,
    ventas: false, contabilidad: false, rrhh: false,
    finanzas: false, agronomia: false, maestros: false, administracion: false,
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  
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

  const isLoading = isAuthLoading || isProfileLoading || isRoleLoading;

  const value = useMemo(() => {
    return {
      isAuthLoading: isLoading,
      usuarioApp: isLoading ? null : (usuarioApp || null),
      permisos: userRole?.permisos || defaultPermissions,
      role: usuarioApp?.rolNombre || null,
    };
  }, [isLoading, usuarioApp, userRole]);


  if (isAuthLoading) { // Only show global loader during initial Firebase Auth check
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
