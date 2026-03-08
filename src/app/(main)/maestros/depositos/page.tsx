"use client";

import { DepositosList } from "@/components/maestros/depositos/depositos-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Deposito } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function DepositosPage() {
  const tenant = useTenantFirestore();
  const depositosQuery = useMemoFirebase(() => tenant.query("depositos", orderBy("nombre")), [tenant]);
  const { data: depositos, isLoading, forceRefetch } = useCollection<Deposito>(depositosQuery);

  return <DepositosList initialDepositos={depositos || []} isLoading={isLoading} onDataChange={forceRefetch} />;
}
