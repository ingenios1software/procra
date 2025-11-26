"use client";

import React, { createContext, useState, useMemo, ReactNode } from 'react';
import { Usuario, UserRole } from '@/lib/types';
import { mockUsuarios } from '@/lib/mock-data';

interface AuthContextType {
  user: Usuario | null;
  role: UserRole;
  setUser: (user: Usuario | null) => void;
  setRole: (role: UserRole) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(mockUsuarios[0]);
  const [role, setRole] = useState<UserRole>('admin');

  const handleSetRole = (newRole: UserRole) => {
    const newUser = mockUsuarios.find(u => u.rol === newRole) || null;
    setUser(newUser);
    setRole(newRole);
  }

  const value = useMemo(() => ({
    user,
    role,
    setUser,
    setRole: handleSetRole,
  }), [user, role]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
