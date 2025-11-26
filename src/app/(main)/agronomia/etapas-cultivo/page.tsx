import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function EtapasCultivoPage() {
  return (
    <>
      <PageHeader
        title="Etapas del Cultivo"
        description="Gestione las etapas fenológicas de sus cultivos."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Etapas del Cultivo en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
