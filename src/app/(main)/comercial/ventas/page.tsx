"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Venta, Parcela, Zafra, Cultivo, Cliente } from "@/lib/types";

export default function VentasComercialPage() {
  const firestore = useFirestore();

  const { data: ventas, isLoading: l1 } = useCollection<Venta>(useMemoFirebase(() => firestore ? query(collection(firestore, 'ventas'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]));
  const { data: cultivos, isLoading: l3 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]));
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]));
  const { data: clientes, isLoading: l5 } = useCollection<Cliente>(useMemoFirebase(() => firestore ? query(collection(firestore, 'clientes')) : null, [firestore]));

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
