"use client";

import { StockList } from "@/components/stock/stock-list";
import { useDataStore } from "@/store/data-store";

export default function StockPage() {
  const { insumos } = useDataStore();

  return (
    <StockList initialInsumos={insumos} />
  );
}
