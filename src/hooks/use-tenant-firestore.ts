"use client";

import { useMemo } from "react";
import type { QueryConstraint } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useAuth } from "@/hooks/use-auth";
import { tenantCollection, tenantDoc, tenantQuery } from "@/lib/tenant";

export function useTenantFirestore() {
  const firestore = useFirestore();
  const { user } = useAuth();
  const empresaId = user?.empresaId || null;

  return useMemo(
    () => ({
      firestore,
      empresaId,
      isReady: Boolean(firestore && empresaId),
      collection: <TCollection extends string>(collectionName: TCollection) =>
        firestore && empresaId ? tenantCollection(firestore, empresaId, collectionName) : null,
      doc: <TCollection extends string>(collectionName: TCollection, documentId: string) =>
        firestore && empresaId ? tenantDoc(firestore, empresaId, collectionName, documentId) : null,
      query: <TCollection extends string>(collectionName: TCollection, ...constraints: QueryConstraint[]) =>
        firestore && empresaId ? tenantQuery(firestore, empresaId, collectionName, ...constraints) : null,
    }),
    [empresaId, firestore]
  );
}
