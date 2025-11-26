import { ParcelasList } from "@/components/parcelas/parcelas-list";
import { mockParcelas } from "@/lib/mock-data";

export default function ParcelasPage() {
  const parcelas = mockParcelas;

  return (
    <ParcelasList initialParcelas={parcelas} />
  );
}
