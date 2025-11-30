"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { useDataStore } from "@/store/data-store";

export default function VentasFinanzasPage() {
  const { ventas, parcelas, zafras, cultivos, clientes, addVenta, updateVenta } = useDataStore();

  return (
    <VentasList 
      ventas={ventas}
      parcelas={parcelas}
      cultivos={cultivos}
      zafras={zafras}
      clientes={clientes}
      onAddVenta={addVenta}
      onUpdateVenta={updateVenta}
      isLoading={false}
    />
  );
}
