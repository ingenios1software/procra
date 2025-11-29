"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import { useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection } from "firebase/firestore";

export default function CrearEventoPage() {
  const router = useRouter();
  const firestore = useFirestore();

  const handleSave = (data: any) => {
    if (!firestore) return;
    const eventosCol = collection(firestore, 'eventos');
    addDocumentNonBlocking(eventosCol, data);
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
