"use client";

import { EmpleadosList } from "@/components/rrhh/empleados/empleados-list";
import { useDataStore } from "@/store/data-store";

export default function EmpleadosPage() {
  const { empleados, roles } = useDataStore();
  return (
    <EmpleadosList 
      initialEmpleados={empleados}
      roles={roles}
    />
  );
}
