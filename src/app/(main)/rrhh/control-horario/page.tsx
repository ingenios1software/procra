"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { ControlHorario, Empleado, Parcela } from '@/lib/types';
import { ControlHorarioList } from "@/components/rrhh/control-horario/control-horario-list";

export default function ControlHorarioPage() {
  const firestore = useFirestore();

  const { data: registros, isLoading: l1 } = useCollection<ControlHorario>(useMemoFirebase(() => firestore ? query(collection(firestore, 'controlHorario'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: empleados, isLoading: l2 } = useCollection<Empleado>(useMemoFirebase(() => firestore ? query(collection(firestore, 'empleados'), orderBy('apellido')) : null, [firestore]));
  const { data: parcelas, isLoading: l3 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]));
  
  const isLoading = l1 || l2 || l3;

  return (
    <ControlHorarioList 
      registros={registros || []}
      empleados={empleados || []}
      parcelas={parcelas || []}
      isLoading={isLoading}
    />
  );
}
