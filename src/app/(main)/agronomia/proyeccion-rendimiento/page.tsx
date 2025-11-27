
import { InformeCostosParcela } from "@/components/agronomia/informe-costos/informe-costos-parcela";
import { mockParcelas, mockCultivos, mockZafras, mockEventos } from "@/lib/mock-data";

export default function InformeCostosParcelaPage() {
    return (
        <InformeCostosParcela 
            parcelas={mockParcelas}
            cultivos={mockCultivos}
            zafras={mockZafras}
            eventos={mockEventos}
        />
    )
}
