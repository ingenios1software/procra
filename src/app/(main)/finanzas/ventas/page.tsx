import { VentasList } from "@/components/finanzas/ventas-list";
import { mockVentas, mockParcelas, mockCultivos, mockZafras } from "@/lib/mock-data";

export default function VentasPage() {
  return (
    <VentasList
      initialVentas={mockVentas}
      parcelas={mockParcelas}
      cultivos={mockCultivos}
      zafras={mockZafras}
    />
  );
}
