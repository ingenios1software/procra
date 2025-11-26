"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { mockParcelas, mockCultivos, mockZafras } from "@/lib/mock-data";
import { useRouter } from "next/navigation";

export default function CrearEventoPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Registrar Nuevo Evento"
        description="Complete los detalles de la actividad agrícola."
      />
      <EventoForm 
        parcelas={mockParcelas}
        cultivos={mockCultivos}
        zafras={mockZafras}
        onCancel={() => router.push('/eventos')}
      />
    </>
  );
}
