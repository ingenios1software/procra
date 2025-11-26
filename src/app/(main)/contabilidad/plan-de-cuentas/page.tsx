import { PageHeader } from "@/components/shared/page-header";
import { PlanDeCuentasList } from "@/components/contabilidad/plan-de-cuentas-list";
import { mockPlanDeCuentas } from "@/lib/mock-data";

export default function PlanDeCuentasPage() {
  return (
    <>
      <PageHeader
        title="Plan de Cuentas"
        description="Gestione el plan de cuentas contables del sistema."
      />
      <PlanDeCuentasList initialData={mockPlanDeCuentas} />
    </>
  );
}
