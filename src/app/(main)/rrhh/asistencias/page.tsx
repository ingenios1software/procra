import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AsistenciasPage() {
  return (
    <>
      <PageHeader
        title="Registro de Asistencias"
        description="Gestione la asistencia y horas trabajadas del personal."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Asistencias en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
