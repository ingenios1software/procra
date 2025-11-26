import { PanelAgronomico } from "@/components/agronomia/panel/panel-agronomico";
import { mockParcelas, mockCultivos, mockZafras, mockEventos, mockInsumos, mockEtapasCultivo } from "@/lib/mock-data";

export default function PanelAgronomicoPage() {
    return (
        <PanelAgronomico 
            parcelas={mockParcelas}
            cultivos={mockCultivos}
            zafras={mockZafras}
            eventos={mockEventos}
            insumos={mockInsumos}
            etapas={mockEtapasCultivo}
        />
    )
}
