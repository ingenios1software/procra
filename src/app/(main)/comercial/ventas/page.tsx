import { PageHeader } from "@/components/shared/page-header";
import { VentasList } from "@/components/finanzas/ventas-list";
import { mockVentas, mockParcelas, mockCultivos, mockZafras } from "@/lib/mock-data";

export default function VentasComercialPage() {
  return (
    <VentasList
      initialVentas={mockVentas}
      parcelas={mockParcelas}
      cultivos={mockCultivos}
      zafras={mockZafras}
    />
  );
}
