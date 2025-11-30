"use client";

import { CostosList } from "@/components/finanzas/costos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Costo, Parcela, Zafra, Cultivo } from "@/lib/types";

export default function CostosPage() {
  const firestore = useFirestore();
  
  const costosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'costos')) : null, [firestore]);
  const { data: costos, isLoading: loadingCostos } = useCollection<Costo>(costosQuery);
  
  const parcelasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]);
  const { data: parcelas, isLoading: loadingParcelas } = useCollection<Parcela>(parcelasQuery);

  const zafrasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]);
  const { data: zafras, isLoading: loadingZafras } = useCollection<Zafra>(zafrasQuery);

  const cultivosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]);
  const { data: cultivos, isLoading: loadingCultivos } = useCollection<Cultivo>(cultivosQuery);

  const isLoading = loadingCostos || loadingParcelas || loadingZafras || loadingCultivos;

  if (isLoading) {
    return <p>Cargando costos...</p>
  }

  return (
    <CostosList 
      costos={costos || []}
      parcelas={parcelas || []}
      zafras={zafras || []}
      cultivos={cultivos || []}
    />
  );
}
