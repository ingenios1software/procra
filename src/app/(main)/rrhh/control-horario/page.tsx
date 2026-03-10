"use client";

import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { ControlHorario, Deposito, Empleado, Parcela, TipoTrabajo } from "@/lib/types";
import { ControlHorarioList } from "@/components/rrhh/control-horario/control-horario-list";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function ControlHorarioPage() {
  const tenant = useTenantFirestore();

  const { data: registros, isLoading: l1 } = useCollection<ControlHorario>(useMemoFirebase(() => tenant.query("controlHorario", orderBy("fecha", "desc")), [tenant]));
  const { data: empleados, isLoading: l2 } = useCollection<Empleado>(useMemoFirebase(() => tenant.query("empleados", orderBy("apellido")), [tenant]));
  const { data: parcelas, isLoading: l3 } = useCollection<Parcela>(useMemoFirebase(() => tenant.query("parcelas", orderBy("nombre")), [tenant]));
  const { data: depositos, isLoading: l4 } = useCollection<Deposito>(useMemoFirebase(() => tenant.query("depositos", orderBy("nombre")), [tenant]));
  const { data: tiposTrabajo, isLoading: l5 } = useCollection<TipoTrabajo>(useMemoFirebase(() => tenant.query("tiposTrabajo", orderBy("nombre")), [tenant]));
  
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
