import { PageHeader } from "@/components/shared/page-header";
import { StockList } from "@/components/stock/stock-list";
import { mockInsumos } from "@/lib/mock-data";

export default function StockPage() {
  const insumos = mockInsumos;

  return (
    <>
      <PageHeader
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      />
      <StockList initialInsumos={insumos} />
    </>
  );
}