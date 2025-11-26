import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function PlagasPage() {
  return (
    <>
      <PageHeader
        title="Gestión de Plagas"
        description="Administre el monitoreo y control de plagas."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Plagas en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
