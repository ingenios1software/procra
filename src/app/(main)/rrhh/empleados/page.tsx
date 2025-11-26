import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function EmpleadosPage() {
  return (
    <>
      <PageHeader
        title="Gestión de Empleados"
        description="Administre la información del personal de la empresa."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Empleados en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
