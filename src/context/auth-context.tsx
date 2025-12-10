"use client";

import React, { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Usuario, UserRole } from '@/lib/types';
import { useUser, useAuth as useFirebaseAuth } from '@/firebase';

interface AuthContextType {
  user: Usuario;
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAuthLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mockUsuarios: Omit<Usuario, 'id' | 'email'>[] = [
    { nombre: 'Usuario Admin', rol: 'admin', activo: true },
    { nombre: 'Usuario Supervisor', rol: 'supervisor', activo: true },
    { nombre: 'Usuario Gerente', rol: 'gerente', activo: true },
    { nombre: 'Usuario Operador', rol: 'operador', activo: true },
    { nombre: 'Usuario Técnico', rol: 'tecnicoCampo', activo: true },
    { nombre: 'Usuario Auditor', rol: 'auditor', activo: true },
    { nombre: 'Usuario Consulta', rol: 'consulta', activo: true },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading } = useUser();
  const [role, setRole] = useState<UserRole>('admin');
  const [user, setUser] = useState<Usuario | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      const mockUserForRole = mockUsuarios.find(u => u.rol === role) || mockUsuarios[0];
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || "anonimo@crapro95.com",
        ...mockUserForRole,
      });
    } else {
      setUser(null);
    }
  }, [firebaseUser, role]);

  const value = useMemo(() => {
    // Si el usuario aún está cargando o no existe, proporcionamos un usuario "dummy" para evitar errores
    const currentUser = user || {
      id: '',
      nombre: 'Cargando...',
      email: '',
      rol: 'consulta',
      activo: false
    };

    return {
      user: currentUser,
      role,
      setRole: (newRole: UserRole) => setRole(newRole),
      isAuthLoading: isUserLoading || !user,
    };
  }, [user, role, isUserLoading]);

  if (value.isAuthLoading) {
    // Puedes mostrar un loader global aquí si lo deseas
    // o simplemente esperar a que el contexto tenga el usuario real
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
