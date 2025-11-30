"use client";

import { CostosList } from "@/components/finanzas/costos-list";
import { useDataStore } from "@/store/data-store";

export default function CostosPage() {
  const { costos, parcelas, zafras, cultivos, addCosto, updateCosto } = useDataStore();
  return (
    <CostosList 
      initialCostos={costos}
      parcelas={parcelas}
      zafras={zafras}
      cultivos={cultivos}
      onAddCosto={addCosto}
      onUpdateCosto={updateCosto}
    />
  );
}
