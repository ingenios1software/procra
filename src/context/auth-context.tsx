'use client';

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

// Grant all permissions to bypass the permission system
const allPermissions: Permisos = {
    compras: true,
    stock: true,
    eventos: true,
    monitoreos: true,
    ventas: true,
    contabilidad: true,
    rrhh: true,
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: isAuthLoading } = useUser();
  
  // This state is kept for the demo role switcher.
  const [role, setRole] = useState<UserRole>('admin');

  const isLoading = isAuthLoading;
  
  const usuarioApp: Usuario | null = useMemo(() => {
    if (!firebaseUser) return null;
    // Create a user profile on the fly from Firebase Auth user
    return {
      id: firebaseUser.uid,
      nombre: firebaseUser.displayName || firebaseUser.email || 'Usuario',
      email: firebaseUser.email || '',
      rol: role,
      activo: true,
      permisos: allPermissions, // Always assign full permissions
    };
  }, [firebaseUser, role]);

  const value = useMemo(() => {
    return {
      isAuthLoading: isLoading,
      usuarioApp: isLoading ? null : usuarioApp,
      permisos: allPermissions,
      role,
      setRole, // Keep for demo
    };
  }, [isLoading, usuarioApp, role]);


  if (isLoading) {
    // You can return a global loader here
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
            <p>Cargando sesión...</p>
        </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
