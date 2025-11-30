"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useDataStore } from "@/store/data-store";
import { useRouter } from "next/navigation";
import type { Evento } from "@/lib/types";

export default function CrearEventoPage() {
  const router = useRouter();
  const { addEvento, parcelas, cultivos, zafras, todosLosEventos, etapasCultivo, insumos, compras } = useDataStore();

  const handleSave = (data: Omit<Evento, 'id'>) => {
    addEvento(data);
    router.push('/eventos');
  }

  return (
    <>
      <PageHeader
        title="Registrar Nuevo Evento"
        description="Complete los detalles de la actividad agrícola."
      />
      <EventoForm 
        onSave={handleSave}
        onCancel={() => router.push('/eventos')}
        parcelas={parcelas}
        cultivos={cultivos}
        zafras={zafras}
        todosLosEventos={todosLosEventos}
        etapasCultivo={etapasCultivo}
        insumos={insumos}
        compras={compras}
      />
    </>
  );
}
