"use client";

import { StockList } from "@/components/stock/stock-list";
import { useDataStore } from "@/store/data-store";

export default function StockPage() {
  const { insumos, compras, eventos, addInsumo, updateInsumo } = useDataStore();
  return (
    <StockList 
      insumos={insumos}
      compras={compras}
      eventos={eventos}
      onAdd={addInsumo}
      onUpdate={updateInsumo}
    />
  );
}
