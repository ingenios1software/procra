"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Maquinaria } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";


export default function MaquinariaPage() {
  const tenant = useTenantFirestore();
  const maquinariaQuery = useMemoFirebase(() => tenant.query("maquinaria", orderBy("nombre")), [tenant]);
  const { data: maquinaria, isLoading } = useCollection<Maquinaria>(maquinariaQuery);

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList 
        maquinaria={maquinaria || []}
        isLoading={isLoading}
      />
    </>
  );
}
