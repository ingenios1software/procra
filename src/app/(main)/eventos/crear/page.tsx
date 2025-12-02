"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import type { Evento } from "@/lib/types";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, getCountFromServer } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";

export default function CrearEventoPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const eventosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('numeroLanzamiento', 'desc')) : null, [firestore]);
  const { data: todosLosEventos } = useCollection<Evento>(eventosQuery);

  const handleSave = async (data: Omit<Evento, 'id'>) => {
    if (!firestore || !todosLosEventos) return;

    const maxLanzamiento = todosLosEventos.length > 0 && todosLosEventos[0].numeroLanzamiento 
      ? todosLosEventos[0].numeroLanzamiento
      : 0;
      
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );

    const eventosCol = collection(firestore, 'eventos');
    const snapshot = await getCountFromServer(eventosCol);
    const numeroItem = snapshot.data().count + 1;

    const dataToSave = { 
        ...cleanData, 
        fecha: (data.fecha as Date).toISOString(),
        numeroLanzamiento: (maxLanzamiento || 0) + 1,
        numeroItem,
    };

    addDocumentNonBlocking(eventosCol, dataToSave);
    
    toast({
        title: `Evento #${dataToSave.numeroLanzamiento} (Item Nº ${numeroItem}) creado`,
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
