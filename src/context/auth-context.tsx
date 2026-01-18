"use client";

import React, { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Usuario, UserRole, Permisos } from '@/lib/types';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface AuthContextType {
  usuarioApp: Usuario | null;
  permisos: Permisos;
  isAuthLoading: boolean;
  role: UserRole | null; // Keep role for compatibility
  setRole: (role: UserRole) => void; // Keep for demo purposes
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultPermissions: Permisos = {
    compras: false,
    stock: false,
    eventos: false,
    monitoreos: false,
    ventas: false,
    contabilidad: false,
    rrhh: false,
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !firebaseUser) return null;
    return doc(firestore, 'usuarios', firebaseUser.uid);
  }, [firestore, firebaseUser]);

  const { data: usuarioApp, isLoading: isProfileLoading } = useDoc<Usuario>(userDocRef);
  
  // This state is kept for the demo role switcher, but real permissions come from `usuarioApp`
  const [role, setRole] = useState<UserRole>('admin');

  const isLoading = isAuthLoading || isProfileLoading;
  
  const value = useMemo(() => {
    const permisos = usuarioApp?.permisos || defaultPermissions;
    const currentRole = usuarioApp?.rol || null;
    
    return {
      isAuthLoading: isLoading,
      usuarioApp: isLoading ? null : usuarioApp,
      permisos,
      role: currentRole,
      setRole, // Keep for demo
    };
  }, [isLoading, usuarioApp, role]);


  if (isLoading) {
    // You can return a global loader here
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
            <p>Cargando sesión y permisos...</p>
        </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
