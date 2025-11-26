import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function DiarioPage() {
  return (
    <>
      <PageHeader
        title="Libro Diario"
        description="Consulte los asientos contables registrados."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Libro Diario en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
