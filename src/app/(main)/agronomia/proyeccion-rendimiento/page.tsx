
import { ProyeccionRendimientoPanel } from "@/components/agronomia/proyeccion-rendimiento/proyeccion-rendimiento-panel";
import { mockParcelas, mockCultivos, mockZafras, mockEventos, mockEtapasCultivo, mockVentas } from "@/lib/mock-data";

export default function ProyeccionRendimientoPage() {
    return (
        <ProyeccionRendimientoPanel 
            parcelas={mockParcelas}
            cultivos={mockCultivos}
            zafras={mockZafras}
            eventos={mockEventos}
            etapas={mockEtapasCultivo}
            ventasHistoricas={mockVentas}
        />
    )
}
