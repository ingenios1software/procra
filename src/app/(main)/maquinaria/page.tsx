"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";

export default function MaquinariaPage() {

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList />
    </>
  );
}
