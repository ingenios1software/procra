"use client";

import { ProveedoresList } from "@/components/comercial/proveedores/proveedores-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Proveedor } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function ProveedoresPage() {
  const tenant = useTenantFirestore();
  const proveedoresQuery = useMemoFirebase(
    () => tenant.query("proveedores", orderBy("nombre")),
    [tenant]
  );
  const { data: proveedores, isLoading } = useCollection<Proveedor>(proveedoresQuery);

  return <ProveedoresList proveedores={proveedores || []} isLoading={isLoading} />;
}
