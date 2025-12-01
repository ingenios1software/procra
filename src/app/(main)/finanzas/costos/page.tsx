"use client";

import { CostosList } from "@/components/finanzas/costos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Costo, Parcela, Zafra, Cultivo } from "@/lib/types";

export default function CostosPage() {
  const firestore = useFirestore();

  const { data: costos, isLoading: l1 } = useCollection<Costo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'costos'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: parcelas, isLoading: l2 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]));
  const { data: cultivos, isLoading: l3 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]));
  const { data: zafras, isLoading: l4 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]));

  return (
    <CostosList 
      initialCostos={costos || []}
      parcelas={parcelas || []}
      zafras={zafras || []}
      cultivos={cultivos || []}
      isLoading={l1 || l2 || l3 || l4}
    />
  );
}
