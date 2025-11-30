"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EventoForm } from "@/components/eventos/evento-form";
import { useRouter } from "next/navigation";
import { useFirestore, addDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Parcela, Cultivo, Zafra, Evento, EtapaCultivo, Insumo, Compra } from "@/lib/types";

export default function CrearEventoPage() {
  const router = useRouter();
  const firestore = useFirestore();

  // Cargar todos los datos maestros necesarios para el formulario
  const { data: parcelas, isLoading: loadingParcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]));
  const { data: cultivos, isLoading: loadingCultivos } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null, [firestore]));
  const { data: zafras, isLoading: loadingZafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]));
  const { data: todosLosEventos, isLoading: loadingEventos } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha')) : null, [firestore]));
  const { data: etapasCultivo, isLoading: loadingEtapas } = useCollection<EtapaCultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'etapasCultivo'), orderBy('orden')) : null, [firestore]));
  const { data: insumos, isLoading: loadingInsumos } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos'), orderBy('nombre')) : null, [firestore]));
  const { data: compras, isLoading: loadingCompras } = useCollection<Compra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'compras'), orderBy('fecha')) : null, [firestore]));

  const isLoading = loadingParcelas || loadingCultivos || loadingZafras || loadingEventos || loadingEtapas || loadingInsumos || loadingCompras;

  const handleSave = (data: any) => {
    if (!firestore) return;
    const eventosCol = collection(firestore, 'eventos');
    const dataToSave = {
        ...data,
        fecha: (data.fecha as Date).toISOString(),
    }
    addDocumentNonBlocking(eventosCol, dataToSave);
    router.push('/eventos');
  }

  if (isLoading) {
    return <p>Cargando datos para el formulario...</p>;
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
