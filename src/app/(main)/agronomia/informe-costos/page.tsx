"use client";

import { InformeCostosParcela } from "@/components/agronomia/informe-costos/informe-costos-parcela";
import { useCollection, useMemoFirebase } from "@/firebase";
import type { Evento, Parcela, Zafra, Cultivo, Insumo, Venta } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function InformeCostosPage() {
  const tenant = useTenantFirestore();

  const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(useMemoFirebase(() => tenant.collection('parcelas'), [tenant]));
  const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(useMemoFirebase(() => tenant.collection('cultivos'), [tenant]));
  const { data: zafras, isLoading: l3 } = useCollection<Zafra>(useMemoFirebase(() => tenant.collection('zafras'), [tenant]));
  const { data: eventos, isLoading: l4 } = useCollection<Evento>(useMemoFirebase(() => tenant.collection('eventos'), [tenant]));
  const { data: insumos, isLoading: l5 } = useCollection<Insumo>(useMemoFirebase(() => tenant.collection('insumos'), [tenant]));
  const { data: ventas, isLoading: l6 } = useCollection<Venta>(useMemoFirebase(() => tenant.collection('ventas'), [tenant]));

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  return (
    <InformeCostosParcela
      parcelas={parcelas || []}
      cultivos={cultivos || []}
      zafras={zafras || []}
      eventos={eventos || []}
      insumos={insumos || []}
      ventas={Array.isArray(ventas) ? ventas : []}
      isLoading={isLoading}
    />
  );
}
