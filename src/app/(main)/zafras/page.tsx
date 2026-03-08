"use client";

import { ZafrasList } from "@/components/zafras/zafras-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Zafra } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function ZafrasPage() {
  const tenant = useTenantFirestore();
  const zafrasQuery = useMemoFirebase(() => tenant.query("zafras", orderBy("numeroItem", "asc")), [tenant]);
  const { data: zafras, isLoading } = useCollection<Zafra>(zafrasQuery);

  return <ZafrasList initialZafras={zafras || []} isLoading={isLoading} />;
}
