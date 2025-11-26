import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";
import { mockMaquinarias } from "@/lib/mock-data";

export default function MaquinariaPage() {
  const maquinarias = mockMaquinarias;

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList initialMaquinarias={maquinarias} />
    </>
  );
}