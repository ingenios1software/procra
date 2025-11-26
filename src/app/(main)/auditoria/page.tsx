import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditoriaPage() {
  return (
    <>
      <PageHeader
        title="Registro de Auditoría"
        description="Revise los registros de actividad del sistema."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Auditoría en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
