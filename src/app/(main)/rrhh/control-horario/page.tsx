"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { ControlHorario, Deposito, Empleado, Parcela, TipoTrabajo } from '@/lib/types';
import { ControlHorarioList } from "@/components/rrhh/control-horario/control-horario-list";

export default function ControlHorarioPage() {
  const firestore = useFirestore();

  const { data: registros, isLoading: l1 } = useCollection<ControlHorario>(useMemoFirebase(() => firestore ? query(collection(firestore, 'controlHorario'), orderBy('fecha', 'desc')) : null, [firestore]));
  const { data: empleados, isLoading: l2 } = useCollection<Empleado>(useMemoFirebase(() => firestore ? query(collection(firestore, 'empleados'), orderBy('apellido')) : null, [firestore]));
  const { data: parcelas, isLoading: l3 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]));
  const { data: depositos, isLoading: l4 } = useCollection<Deposito>(useMemoFirebase(() => firestore ? query(collection(firestore, 'depositos'), orderBy('nombre')) : null, [firestore]));
  const { data: tiposTrabajo, isLoading: l5 } = useCollection<TipoTrabajo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'tiposTrabajo'), orderBy('nombre')) : null, [firestore]));
  
  const isLoading = l1 || l2 || l3 || l4 || l5;

  return (
    <ControlHorarioList 
      registros={registros || []}
      empleados={empleados || []}
      parcelas={parcelas || []}
      depositos={depositos || []}
      tiposTrabajo={tiposTrabajo || []}
      isLoading={isLoading}
    />
  );
}
