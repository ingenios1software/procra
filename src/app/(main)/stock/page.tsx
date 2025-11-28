import { PageHeader } from "@/components/shared/page-header";
import { StockList } from "@/components/stock/stock-list";
import { mockInsumos } from "@/lib/mock-data";

export default function StockPage() {
  const insumos = mockInsumos;

  return (
    <StockList initialInsumos={insumos} />
  );
}
