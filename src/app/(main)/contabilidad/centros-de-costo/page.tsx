import { PageHeader } from "@/components/shared/page-header";
import { CentrosDeCostoList } from "@/components/contabilidad/centros-de-costo-list";
import { mockCentrosDeCosto } from "@/lib/mock-data";

export default function CentrosDeCostoPage() {
  return (
    <>
      <PageHeader
        title="Centros de Costo"
        description="Administre los centros de costo para el análisis financiero."
      />
      <CentrosDeCostoList initialData={mockCentrosDeCosto} />
    </>
  );
}
