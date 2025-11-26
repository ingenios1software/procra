"use client";

import { EmpleadosList } from "@/components/rrhh/empleados/empleados-list";
import { mockEmpleados, mockRoles } from "@/lib/mock-data";

export default function EmpleadosPage() {
  return (
    <EmpleadosList 
      initialEmpleados={mockEmpleados}
      roles={mockRoles}
    />
  );
}
