"use client";

import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { PageHeader } from "@/components/shared/page-header";
import { ParcelasOverviewMap } from "@/components/parcelas/parcelas-overview-map";
import { Button } from "@/components/ui/button";
import { useCollection, useMemoFirebase } from "@/firebase";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import type { Parcela } from "@/lib/types";

export default function ParcelasMapaGeneralPage() {
  const tenant = useTenantFirestore();
  const parcelasQuery = useMemoFirebase(() => tenant.query("parcelas", orderBy("nombre")), [tenant]);
  const { data: parcelas, isLoading } = useCollection<Parcela>(parcelasQuery);

  return (
    <>
      <PageHeader
        title="Mapa General de Parcelas"
        description="Consolide sus parcelas en una sola vista para ubicar rapidamente lotes, sectores y superficies."
      >
        <Button variant="outline" asChild>
          <Link href="/parcelas">Volver a Parcelas</Link>
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <p>Cargando mapa general...</p>
        </div>
      ) : (
        <ParcelasOverviewMap parcelas={parcelas || []} />
      )}
    </>
  );
}
