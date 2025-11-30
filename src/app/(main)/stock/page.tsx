"use client";

import { StockList } from "@/components/stock/stock-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Insumo, Compra, Evento } from "@/lib/types";

export default function StockPage() {
  const firestore = useFirestore();

  const insumosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos'), orderBy('nombre')) : null, [firestore]);
  const { data: insumos = [], isLoading: isLoadingInsumos } = useCollection<Insumo>(insumosQuery);

  const comprasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'compras'), orderBy('fecha')) : null, [firestore]);
  const { data: compras = [], isLoading: isLoadingCompras } = useCollection<Compra>(comprasQuery);
  
  const eventosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha')) : null, [firestore]);
  const { data: eventos = [], isLoading: isLoadingEventos } = useCollection<Evento>(eventosQuery);

  const isLoading = isLoadingInsumos || isLoadingCompras || isLoadingEventos;

  return (
    <StockList 
      insumos={insumos}
      compras={compras}
      eventos={eventos}
      isLoading={isLoading}
    />
  );
}
