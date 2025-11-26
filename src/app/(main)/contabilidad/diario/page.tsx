import { PageHeader } from "@/components/shared/page-header";
import { DiarioList } from "@/components/contabilidad/diario-list";
import { mockAsientosDiario, mockPlanDeCuentas, mockCentrosDeCosto } from "@/lib/mock-data";

export default function DiarioPage() {
  return (
    <>
      <PageHeader
        title="Libro Diario"
        description="Registre y consulte los asientos contables."
      />
      <DiarioList 
        initialData={mockAsientosDiario}
        planDeCuentas={mockPlanDeCuentas}
        centrosDeCosto={mockCentrosDeCosto}
      />
    </>
  );
}
