"use client";

import { CostosList } from "@/components/finanzas/costos-list";
import { useDataStore } from "@/store/data-store";

export default function CostosPage() {
  const { costos, parcelas, cultivos, zafras } = useDataStore();
  return (
    <CostosList
      initialCostos={costos}
      parcelas={parcelas}
      cultivos={cultivos}
      zafras={zafras}
    />
  );
}
