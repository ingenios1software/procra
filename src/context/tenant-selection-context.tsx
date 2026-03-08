"use client";

import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { EmpresaSaaS } from "@/lib/types";

type TenantSelectionContextType = {
  empresaId: string | null;
  empresa: EmpresaSaaS | null;
  empresas: EmpresaSaaS[];
  isLoading: boolean;
  canSelectEmpresa: boolean;
  setEmpresaId: (empresaId: string) => void;
  refreshEmpresas: () => void;
};

const STORAGE_KEY = "procra.selectedEmpresaId";

export const TenantSelectionContext = createContext<TenantSelectionContextType | undefined>(undefined);

export function TenantSelectionProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const { user } = useAuth();
  const canSelectEmpresa = Boolean(user?.esSuperAdmin);
  const ownEmpresaId = user?.empresaId || null;
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(ownEmpresaId);

  const empresasQuery = useMemoFirebase(
    () => (firestore && canSelectEmpresa ? collection(firestore, "empresas") : null),
    [canSelectEmpresa, firestore]
  );
  const { data: empresasData, isLoading: isEmpresasLoading, forceRefetch } = useCollection<EmpresaSaaS>(empresasQuery);

  const empresas = useMemo(
    () =>
      [...(empresasData || [])].sort((left, right) =>
        (left.nombre || "").localeCompare(right.nombre || "", "es", { sensitivity: "base" })
      ),
    [empresasData]
  );
  const empresaId = canSelectEmpresa ? selectedEmpresaId : ownEmpresaId;
  const empresa = useMemo(
    () => empresas.find((candidate) => candidate.id === empresaId) || null,
    [empresaId, empresas]
  );

  useEffect(() => {
    if (!user) {
      setSelectedEmpresaId(null);
      return;
    }

    if (!canSelectEmpresa) {
      setSelectedEmpresaId(ownEmpresaId);
      return;
    }

    if (typeof window === "undefined") return;
    const storedEmpresaId = window.localStorage.getItem(STORAGE_KEY)?.trim() || "";
    setSelectedEmpresaId(storedEmpresaId || ownEmpresaId);
  }, [canSelectEmpresa, ownEmpresaId, user]);

  useEffect(() => {
    if (!user || !canSelectEmpresa) return;

    const validIds = new Set(empresas.map((empresa) => empresa.id));
    if (validIds.size === 0) {
      setSelectedEmpresaId(null);
      return;
    }

    const nextEmpresaId =
      (selectedEmpresaId && validIds.has(selectedEmpresaId) ? selectedEmpresaId : null) ||
      (ownEmpresaId && validIds.has(ownEmpresaId) ? ownEmpresaId : null) ||
      empresas[0]?.id ||
      null;

    if (nextEmpresaId !== selectedEmpresaId) {
      setSelectedEmpresaId(nextEmpresaId);
    }
  }, [canSelectEmpresa, empresas, ownEmpresaId, selectedEmpresaId, user]);

  useEffect(() => {
    if (!canSelectEmpresa || typeof window === "undefined") return;

    if (selectedEmpresaId) {
      window.localStorage.setItem(STORAGE_KEY, selectedEmpresaId);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [canSelectEmpresa, selectedEmpresaId]);

  const handleSetEmpresaId = useCallback(
    (empresaId: string) => {
      if (!canSelectEmpresa) return;
      const normalizedEmpresaId = empresaId.trim();
      if (!normalizedEmpresaId) return;
      setSelectedEmpresaId(normalizedEmpresaId);
    },
    [canSelectEmpresa]
  );

  const value = useMemo(
    () => ({
      empresaId,
      empresa,
      empresas,
      isLoading: canSelectEmpresa ? isEmpresasLoading : false,
      canSelectEmpresa,
      setEmpresaId: handleSetEmpresaId,
      refreshEmpresas: forceRefetch,
    }),
    [canSelectEmpresa, empresa, empresaId, empresas, forceRefetch, handleSetEmpresaId, isEmpresasLoading]
  );

  return <TenantSelectionContext.Provider value={value}>{children}</TenantSelectionContext.Provider>;
}
