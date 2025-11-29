"use client";
import { EventosList } from "@/components/eventos/eventos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Evento, Parcela, Zafra, Cultivo } from "@/lib/types";

export default function EventosPage() {
  const firestore = useFirestore();
  const { data: eventos, isLoading: isLoadingEventos } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? collection(firestore, 'parcelas') : null, [firestore]));
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));
  const { data: cultivos, isLoading: isLoadingCultivos } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'cultivos') : null, [firestore]));

  const isLoading = isLoadingEventos || isLoadingParcelas || isLoadingZafras || isLoadingCultivos;

  return (
    <EventosList 
      eventos={eventos || []}
      parcelas={parcelas || []}
      zafras={zafras || []}
      cultivos={cultivos || []}
      isLoading={isLoading}
    />
  );
}
