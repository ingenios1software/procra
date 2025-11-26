import { EventosList } from "@/components/eventos/eventos-list";
import { mockEventos, mockCultivos, mockParcelas, mockZafras } from "@/lib/mock-data";

export default function EventosPage() {
  return (
    <EventosList
      initialEventos={mockEventos}
      parcelas={mockParcelas}
      zafras={mockZafras}
      cultivos={mockCultivos}
    />
  );
}
