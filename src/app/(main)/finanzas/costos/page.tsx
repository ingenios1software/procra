import { PageHeader } from "@/components/shared/page-header";
import { CostosList } from "@/components/finanzas/costos-list";
import { mockCostos, mockParcelas, mockCultivos, mockZafras } from "@/lib/mock-data";

export default function CostosPage() {
  return (
    <CostosList
      initialCostos={mockCostos}
      parcelas={mockParcelas}
      cultivos={mockCultivos}
      zafras={mockZafras}
    />
  );
}
