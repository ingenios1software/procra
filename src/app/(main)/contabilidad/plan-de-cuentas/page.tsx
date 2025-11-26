import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function PlanDeCuentasPage() {
  return (
    <>
      <PageHeader
        title="Plan de Cuentas"
        description="Administre el plan contable de la empresa."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Plan de Cuentas en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
