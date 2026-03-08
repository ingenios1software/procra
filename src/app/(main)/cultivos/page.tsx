"use client";

import { CultivosList } from "@/components/cultivos/cultivos-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Cultivo } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function CultivosPage() {
  const tenant = useTenantFirestore();
  const cultivosQuery = useMemoFirebase(() => tenant.query("cultivos", orderBy("nombre")), [tenant]);
  const { data: cultivos, isLoading } = useCollection<Cultivo>(cultivosQuery);

  return <CultivosList initialCultivos={cultivos || []} isLoading={isLoading} />;
}
