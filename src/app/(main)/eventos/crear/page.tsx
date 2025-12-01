"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import type { Evento } from "@/lib/types";
import { useFirestore, addDocumentNonBlocking } from "@/firebase";
import { collection } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";

export default function CrearEventoPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleSave = (data: Omit<Evento, 'id'>) => {
    if (!firestore) return;
    const dataToSave = { ...data, fecha: (data.fecha as Date).toISOString() };
    const eventosCol = collection(firestore, 'eventos');
    addDocumentNonBlocking(eventosCol, dataToSave);
    
    toast({
        title: `Evento creado`,
        description: `El evento "${data.descripcion}" ha sido guardado.`,
    });
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
