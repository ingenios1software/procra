"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import { useDataStore } from "@/store/data-store";

export default function CrearEventoPage() {
  const router = useRouter();
  const { addEvento } = useDataStore();

  const handleSave = (data: any) => {
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
      />
    </>
  );
}
