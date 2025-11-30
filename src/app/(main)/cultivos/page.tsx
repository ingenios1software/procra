"use client";

import { CultivosList } from "@/components/cultivos/cultivos-list";
import { useDataStore } from "@/store/data-store";

export default function CultivosPage() {
  const { cultivos, addCultivo, updateCultivo, deleteCultivo } = useDataStore();

  return (
    <>
      <CultivosList
        initialCultivos={cultivos}
        onAdd={addCultivo}
        onUpdate={updateCultivo}
        onDelete={deleteCultivo}
      />
    </>
  );
}
