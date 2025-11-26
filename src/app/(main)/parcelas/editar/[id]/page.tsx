import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import { mockParcelas } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default function EditarParcelaPage({ params }: { params: { id: string } }) {
  const parcela = mockParcelas.find(p => p.id === params.id);

  if (!parcela) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Parcela"
        description={`Editando los detalles de ${parcela.nombre}.`}
      />
      <ParcelaForm parcela={parcela} />
    </>
  );
}
