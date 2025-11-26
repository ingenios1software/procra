import { PageHeader } from "@/components/shared/page-header";
import { MayorView } from "@/components/contabilidad/mayor-view";
import { mockAsientosDiario, mockPlanDeCuentas } from "@/lib/mock-data";

export default function MayorPage() {
  return (
    <>
      <PageHeader
        title="Libro Mayor"
        description="Analice los movimientos por cuenta contable."
      />
      <MayorView 
        asientos={mockAsientosDiario}
        cuentas={mockPlanDeCuentas}
      />
    </>
  );
}
