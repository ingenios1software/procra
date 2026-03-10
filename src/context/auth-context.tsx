'use client';

import React, { createContext, useState, useMemo, ReactNode, useEffect } from 'react';
import { Usuario, Permisos, Rol, EmpresaSaaS } from '@/lib/types';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, query, where } from 'firebase/firestore';
import { getEstadoComercial, mergePermisosByGate, normalizePermisos, resolveModulosComprados } from '@/lib/suscripcion-saas';
import { tenantCollection, tenantDoc } from '@/lib/tenant';

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
    finanzas: false, agronomia: false, maestros: false,
    usuarios: false, roles: false, administracion: false,
};

const allPermissions: Permisos = {
    compras: true, stock: true, eventos: true, monitoreos: true,
    ventas: true, contabilidad: true, rrhh: true,
    finanzas: true, agronomia: true, maestros: true,
    usuarios: true, roles: true, administracion: true,
};

const TENANT_ROLE_ALIASES: Record<string, string> = {
  admin: "admin",
  tecnico: "tecnico",
  tecnicocampo: "tecnico",
  supervisor: "tecnico",
  capataz: "tecnico",
  operador: "operador",
  gerente: "consulta",
  auditor: "consulta",
  consulta: "consulta",
};

function normalizeRoleKey(value?: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveTenantRoleAliasId(usuarioApp: Usuario | null | undefined): string | null {
  const directRoleName = normalizeRoleKey(usuarioApp?.rolNombre);
  if (directRoleName && TENANT_ROLE_ALIASES[directRoleName]) {
    return TENANT_ROLE_ALIASES[directRoleName];
  }

  const normalizedRoleId = normalizeRoleKey(usuarioApp?.rolId);
  if (normalizedRoleId && TENANT_ROLE_ALIASES[normalizedRoleId]) {
    return TENANT_ROLE_ALIASES[normalizedRoleId];
  }

  return null;
}


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
  const tenantRoleAliasId = resolveTenantRoleAliasId(usuarioApp || null);
  const directTenantRoleRef = useMemoFirebase(() =>
    usuarioApp?.empresaId && usuarioApp?.rolId && firestore
      ? tenantDoc(firestore, usuarioApp.empresaId, 'roles', usuarioApp.rolId)
      : null,
    [firestore, usuarioApp?.empresaId, usuarioApp?.rolId]
  );
  const { data: directTenantRole, isLoading: isDirectTenantRoleLoading } = useDoc<Rol>(directTenantRoleRef);
  const namedTenantRoleQuery = useMemoFirebase(
    () =>
      usuarioApp?.empresaId &&
      usuarioApp?.rolNombre &&
      firestore
        ? query(tenantCollection(firestore, usuarioApp.empresaId, 'roles'), where('nombre', '==', usuarioApp.rolNombre))
        : null,
    [firestore, usuarioApp?.empresaId, usuarioApp?.rolNombre]
  );
  const { data: namedTenantRoles, isLoading: isNamedTenantRolesLoading } = useCollection<Rol>(namedTenantRoleQuery);
  const namedTenantRole = namedTenantRoles?.[0] || null;
  const aliasTenantRoleRef = useMemoFirebase(
    () =>
      usuarioApp?.empresaId &&
      tenantRoleAliasId &&
      tenantRoleAliasId !== usuarioApp?.rolId &&
      firestore
        ? tenantDoc(firestore, usuarioApp.empresaId, 'roles', tenantRoleAliasId)
        : null,
    [firestore, tenantRoleAliasId, usuarioApp?.empresaId, usuarioApp?.rolId]
  );
  const { data: aliasTenantRole, isLoading: isAliasTenantRoleLoading } = useDoc<Rol>(aliasTenantRoleRef);
  const legacyRoleRef = useMemoFirebase(
    () => (!usuarioApp?.empresaId && usuarioApp?.rolId && firestore ? doc(firestore, 'roles', usuarioApp.rolId) : null),
    [usuarioApp?.empresaId, usuarioApp?.rolId, firestore]
  );
  const { data: legacyRole, isLoading: isLegacyRoleLoading } = useDoc<Rol>(legacyRoleRef);

  const empresaRef = useMemoFirebase(
    () => (usuarioApp?.empresaId && firestore ? doc(firestore, 'empresas', usuarioApp.empresaId) : null),
    [usuarioApp?.empresaId, firestore]
  );
  const { data: empresaSaaS, isLoading: isEmpresaLoading } = useDoc<EmpresaSaaS>(empresaRef);

  const resolvedRole = usuarioApp?.empresaId
    ? (directTenantRole || namedTenantRole || aliasTenantRole || null)
    : (legacyRole || null);
  const isLoading =
    (isAuthLoading && !authTimedOut && !userError) ||
    isProfileLoading ||
    isDirectTenantRoleLoading ||
    isNamedTenantRolesLoading ||
    isAliasTenantRoleLoading ||
    isLegacyRoleLoading ||
    isEmpresaLoading;

  const value = useMemo(() => {
    const isPlatformAdmin = Boolean(usuarioApp?.esSuperAdmin);
    const isTenantAdmin =
      Boolean(usuarioApp?.empresaId) &&
      (normalizeRoleKey(usuarioApp?.rolId) === 'admin' || normalizeRoleKey(usuarioApp?.rolNombre) === 'admin');
    const estadoComercial = getEstadoComercial(empresaSaaS || null);
    const permisosPorRol =
      isPlatformAdmin || isTenantAdmin
        ? allPermissions
        : normalizePermisos(resolvedRole?.permisos || defaultPermissions);
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
      usuarios: estadoComercial.acceso,
      roles: estadoComercial.acceso,
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
      role: resolvedRole?.nombre || usuarioApp?.rolNombre || null,
      empresa: empresaSaaS || null,
      estadoComercial,
    };
  }, [empresaSaaS, isLoading, resolvedRole, usuarioApp]);


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

