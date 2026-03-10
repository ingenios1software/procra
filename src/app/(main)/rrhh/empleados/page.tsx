"use client";

import { EmpleadosList } from "@/components/rrhh/empleados/empleados-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Empleado } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";


export default function EmpleadosPage() {
  const tenant = useTenantFirestore();
  const empleadosQuery = useMemoFirebase(() => tenant.query("empleados", orderBy("apellido")), [tenant]);
  const { data: empleados, isLoading } = useCollection<Empleado>(empleadosQuery);

  return (
    <EmpleadosList empleados={empleados || []} isLoading={isLoading} />
  );
}
