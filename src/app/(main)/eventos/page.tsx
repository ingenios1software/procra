"use client";
import { EventosList } from "@/components/eventos/eventos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Evento, Parcela, Zafra, Cultivo } from '@/lib/types';

export default function EventosPage() {
  const firestore = useFirestore();

  const eventosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha', 'desc')) : null, [firestore]);
  const { data: eventos, isLoading: isLoadingEventos } = useCollection<Evento>(eventosQuery);

  const parcelasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas')) : null, [firestore]);
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(parcelasQuery);

  const zafrasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras')) : null, [firestore]);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(zafrasQuery);

  const cultivosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos')) : null, [firestore]);
  const { data: cultivos, isLoading: isLoadingCultivos } = useCollection<Cultivo>(cultivosQuery);

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
