import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";

export default function CrearParcelaPage() {
  return (
    <>
      <PageHeader
        title="Crear Nueva Parcela"
        description="Complete los detalles de la nueva parcela."
      />
      <ParcelaForm />
    </>
  );
}
