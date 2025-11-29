"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { useDataStore } from "@/store/data-store";

export default function VentasComercialPage() {
  const { ventas, parcelas, cultivos, zafras, clientes } = useDataStore();
  return (
    <VentasList
      initialVentas={ventas}
      parcelas={parcelas}
      cultivos={cultivos}
      zafras={zafras}
      clientes={clientes}
    />
  );
}
