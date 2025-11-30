
"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Venta, Parcela, Cultivo, Zafra, Cliente } from "@/lib/types";

export default function VentasFinanzasPage() {
  const firestore = useFirestore();

  const ventasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'ventas'), orderBy('fecha', 'desc')) : null, [firestore]);
  const { data: ventas, isLoading: isLoadingVentas } = useCollection<Venta>(ventasQuery);

  const parcelasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]);
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(parcelasQuery);
  
  const zafrasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(zafrasQuery);

  const cultivosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]);
  const { data: cultivos, isLoading: isLoadingCultivos } = useCollection<Cultivo>(cultivosQuery);
  
  const clientesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'clientes')) : null, [firestore]);
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(clientesQuery);

  const isLoading = isLoadingVentas || isLoadingParcelas || isLoadingZafras || isLoadingCultivos || isLoadingClientes;

  return (
    <VentasList 
      ventas={ventas || []}
      parcelas={parcelas || []}
      cultivos={cultivos || []}
      zafras={zafras || []}
      clientes={clientes || []}
      isLoading={isLoading}
    />
  );
}
