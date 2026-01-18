"use client";

import { useContext } from 'react';
import { AuthContext } from '@/context/auth-context';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // The user property from firebase is now replaced by usuarioApp from firestore
  const { usuarioApp, ...rest } = context;
  return { user: usuarioApp, ...rest };
};
