"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RegistrarEventoModal } from "@/components/monitoreo/RegistrarEventoModal";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Evento, Parcela, Zafra, Cultivo } from "@/lib/types";
import { collection, query, orderBy } from 'firebase/firestore';

export default function MonitoreoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const firestore = useFirestore();

  const { data: eventos, isLoading, forceRefetch } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha', 'desc')) : null, [firestore]));

  const { data: parcelas } = useCollection<Parcela>(useMemoFirebase(() => firestore ? collection(firestore, 'parcelas') : null, [firestore]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore]));
  const { data: cultivos } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? collection(firestore, 'cultivos') : null, [firestore]));

  const handleEventSaved = () => {
    setIsModalOpen(false);
    forceRefetch();
  }

  return (
    <>
      <PageHeader
        title="Monitoreo de Cultivos"
        description="Registro y seguimiento de todas las actividades en el campo."
      >
        <Button onClick={() => setIsModalOpen(true)} className="fixed bottom-16 right-4 z-50 h-16 w-16 rounded-full shadow-lg md:relative md:bottom-auto md:right-auto md:h-auto md:w-auto md:rounded-md">
          <Plus className="h-6 w-6 md:mr-2" />
          <span className="hidden md:inline">Registrar Evento</span>
        </Button>
      </PageHeader>
      
      {isLoading && <p>Cargando eventos...</p>}
      
      {!isLoading && eventos && (
        <div className="space-y-4">
          {/* Aquí irá la lista de eventos recientes */}
          <p>Se encontraron {eventos.length} eventos.</p>
        </div>
      )}

      <RegistrarEventoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEventSaved={handleEventSaved}
        parcelas={parcelas || []}
        zafras={zafras || []}
        cultivos={cultivos || []}
      />
    </>
  );
}
