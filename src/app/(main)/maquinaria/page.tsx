"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";
import { useDataStore } from "@/store/data-store";

export default function MaquinariaPage() {
  const { maquinaria, addMaquinaria, updateMaquinaria, deleteMaquinaria } = useDataStore();

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList 
        initialMaquinaria={maquinaria}
        onAdd={addMaquinaria}
        onUpdate={updateMaquinaria}
        onDelete={deleteMaquinaria}
      />
    </>
  );
}
