"use client";

import { ClientesList } from "@/components/comercial/clientes/clientes-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Cliente } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function ClientesPage() {
  const tenant = useTenantFirestore();
  const clientesQuery = useMemoFirebase(
    () => tenant.query("clientes", orderBy("nombre")),
    [tenant]
  );
  const { data: clientes, isLoading } = useCollection<Cliente>(clientesQuery);

  return <ClientesList clientes={clientes || []} isLoading={isLoading} />;
}
