"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useDoc, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/shared/page-header";
import { ParcelaMapModule } from "@/components/parcelas/parcela-map-module";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import type { ParcelaMapaData } from "@/lib/parcela-mapa";

export default function ParcelaMapaPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const tenant = useTenantFirestore();
  const parcelaRef = useMemoFirebase(() => tenant.doc("parcelas", params.id), [tenant, params.id]);
  const { data: parcela, isLoading } = useDoc<ParcelaMapaData>(parcelaRef);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p>Cargando modulo de mapa...</p>
      </div>
    );
  }

  if (!parcela) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Parcela no encontrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>La parcela solicitada no existe o fue eliminada.</p>
            <Button onClick={() => router.push("/parcelas")}>
              Volver a Parcelas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Mapa: ${parcela.nombre}`}
        description="Importe el KML de la parcela, visualice el contorno y registre puntos con comentarios sobre el terreno."
      >
        <Button variant="outline" onClick={() => router.push(`/parcelas/${parcela.id}`)}>
          Ver reporte
        </Button>
        <Button onClick={() => router.push("/parcelas")}>Volver a Parcelas</Button>
      </PageHeader>

      <ParcelaMapModule parcela={parcela} />
    </>
  );
}
