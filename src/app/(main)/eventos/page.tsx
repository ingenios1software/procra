"use client";
import { EventosList } from "@/components/eventos/eventos-list";
import { useDataStore } from "@/store/data-store";

export default function EventosPage() {
  const { eventos, parcelas, zafras, cultivos } = useDataStore();
  return (
    <EventosList 
      eventos={eventos}
      parcelas={parcelas}
      zafras={zafras}
      cultivos={cultivos}
    />
  );
}
