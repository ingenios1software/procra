"use client";

import { ParcelasList } from "@/components/parcelas/parcelas-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Parcela } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function ParcelasPage() {
  const tenant = useTenantFirestore();
  const parcelasQuery = useMemoFirebase(() => tenant.query("parcelas", orderBy("nombre")), [tenant]);
  const { data: parcelas, isLoading } = useCollection<Parcela>(parcelasQuery);

  return <ParcelasList parcelas={parcelas || []} isLoading={isLoading} />;
}
