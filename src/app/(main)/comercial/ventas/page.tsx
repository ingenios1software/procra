"use client";

import { VentasList } from "@/components/finanzas/ventas-list";
import { mockVentas, mockParcelas, mockCultivos, mockZafras, mockClientes } from "@/lib/mock-data";

export default function VentasComercialPage() {
  return (
    <VentasList
      initialVentas={mockVentas}
      parcelas={mockParcelas}
      cultivos={mockCultivos}
      zafras={mockZafras}
      clientes={mockClientes}
    />
  );
}
