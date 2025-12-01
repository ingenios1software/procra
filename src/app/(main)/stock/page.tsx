"use client";

import { StockList } from "@/components/stock/stock-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Insumo, Compra, Evento } from "@/lib/types";

export default function StockPage() {
  const firestore = useFirestore();
  
  const { data: insumos, isLoading: l1 } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos')) : null, [firestore]));
  const { data: compras, isLoading: l2 } = useCollection<Compra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'compras')) : null, [firestore]));
  const { data: eventos, isLoading: l3 } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos')) : null, [firestore]));

  return (
    <StockList 
      insumos={insumos || []}
      compras={compras || []}
      eventos={eventos || []}
      isLoading={l1 || l2 || l3}
    />
  );
}
