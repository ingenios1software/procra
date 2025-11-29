"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";
import { useDataStore } from "@/store/data-store";

export default function MaquinariaPage() {
  const { maquinarias } = useDataStore();

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList initialMaquinarias={maquinarias} />
    </>
  );
}
