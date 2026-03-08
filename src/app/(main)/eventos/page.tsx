"use client";

import { EventosList } from "@/components/eventos/eventos-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Evento, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function EventosPage() {
  const tenant = useTenantFirestore();

  const eventosQuery = useMemoFirebase(() => tenant.query("eventos", orderBy("fecha", "desc")), [tenant]);
  const { data: eventos, isLoading: isLoadingEventos } = useCollection<Evento>(eventosQuery);

  const parcelasQuery = useMemoFirebase(() => tenant.collection("parcelas"), [tenant]);
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(parcelasQuery);

  const zafrasQuery = useMemoFirebase(() => tenant.collection("zafras"), [tenant]);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(zafrasQuery);

  const cultivosQuery = useMemoFirebase(() => tenant.collection("cultivos"), [tenant]);
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
