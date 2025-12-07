"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import type { Evento } from "@/lib/types";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { procesarConsumoDeStockDesdeEvento } from "@/lib/stock/consumo-desde-evento";

export default function CrearEventoPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleSave = async (data: Omit<Evento, 'id'>) => {
    if (!firestore || !user) return;

    const eventosCol = collection(firestore, 'eventos');
    
    // Obtener máximo numeroLanzamiento
    const qLanzamiento = query(eventosCol, orderBy("numeroLanzamiento", "desc"), limit(1));
    const lanzSnapshot = await getDocs(qLanzamiento);
    let maxLanzamiento = 0;
    if (!lanzSnapshot.empty) {
        maxLanzamiento = lanzSnapshot.docs[0].data().numeroLanzamiento || 0;
    }

    // Obtener máximo numeroItem
    const qItem = query(eventosCol, orderBy("numeroItem", "desc"), limit(1));
    const itemSnapshot = await getDocs(qItem);
    let maxNumeroItem = 0;
    if (!itemSnapshot.empty) {
        maxNumeroItem = itemSnapshot.docs[0].data().numeroItem || 0;
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );

    const dataToSave = { 
        ...cleanData, 
        fecha: (data.fecha as Date).toISOString(),
        numeroLanzamiento: maxLanzamiento + 1,
        numeroItem: maxNumeroItem + 1,
        estado: 'pendiente' as const,
        creadoPor: user.uid,
        creadoEn: serverTimestamp(),
    };

    const docRef = await addDocumentNonBlocking(eventosCol, dataToSave);
    
    if (docRef) {
      const eventoGuardado = { ...data, ...dataToSave, id: docRef.id };
      // El consumo de stock ahora debería ser condicional al estado 'aprobado'
      // Por ahora, lo dejamos así hasta refactorizarlo.
      const { success, errors } = await procesarConsumoDeStockDesdeEvento(eventoGuardado, firestore, user.uid);
      if (!success) {
        toast({
          variant: "destructive",
          title: "Error en el consumo de stock",
          description: errors.join('. '),
        });
      }
    }
    
    toast({
        title: `Evento #${dataToSave.numeroLanzamiento} (Item Nº ${dataToSave.numeroItem}) creado`,
        description: `El evento "${data.descripcion}" ha sido guardado y está pendiente de aprobación.`,
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
