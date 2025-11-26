import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function CentrosDeCostoPage() {
  return (
    <>
      <PageHeader
        title="Centros de Costo"
        description="Gestione los centros de costo de la empresa."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Centros de Costo en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
