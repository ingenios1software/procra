import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function MayorPage() {
  return (
    <>
      <PageHeader
        title="Libro Mayor"
        description="Analice los movimientos por cada cuenta contable."
      />
      <Card>
        <CardContent className="p-6">
          <p>Módulo de Libro Mayor en construcción.</p>
        </CardContent>
      </Card>
    </>
  );
}
