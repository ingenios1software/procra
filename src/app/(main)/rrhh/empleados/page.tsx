"use client";

import { EmpleadosList } from "@/components/rrhh/empleados/empleados-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Empleado } from '@/lib/types';


export default function EmpleadosPage() {
  const firestore = useFirestore();
  const empleadosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'empleados'), orderBy('apellido')) : null, [firestore]);
  const { data: empleados, isLoading } = useCollection<Empleado>(empleadosQuery);

  return (
    <EmpleadosList empleados={empleados || []} isLoading={isLoading} />
  );
}
