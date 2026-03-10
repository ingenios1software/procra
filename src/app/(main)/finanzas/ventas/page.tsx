"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Venta, Parcela, Zafra, Cultivo, Cliente } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function VentasFinanzasPage() {
  const tenant = useTenantFirestore();

  const { data: ventas, isLoading: l1 } = useCollection<Venta>(useMemoFirebase(() => tenant.query("ventas", orderBy("fecha", "desc")), [tenant]));
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(useMemoFirebase(() => tenant.collection("parcelas"), [tenant]));
  const { data: cultivos, isLoading: l3 } = useCollection<Cultivo>(useMemoFirebase(() => tenant.collection("cultivos"), [tenant]));
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(useMemoFirebase(() => tenant.collection("zafras"), [tenant]));
  const { data: clientes, isLoading: l5 } = useCollection<Cliente>(useMemoFirebase(() => tenant.collection("clientes"), [tenant]));


  return (
    <VentasList 
      ventas={ventas || []}
      parcelas={parcelas || []}
      cultivos={cultivos || []}
      zafras={zafras || []}
      clientes={clientes || []}
      isLoading={l1 || l2 || l3 || l4 || l5}
    />
  );
}
