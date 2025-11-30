"use client";

import { ParcelasList } from "@/components/parcelas/parcelas-list";
import { useDataStore } from "@/store/data-store";

export default function ParcelasPage() {
  const { parcelas, addParcela, updateParcela, deleteParcela } = useDataStore();

  return (
    <ParcelasList 
      parcelas={parcelas}
      onAdd={addParcela}
      onUpdate={updateParcela}
      onDelete={deleteParcela}
    />
  );
}
