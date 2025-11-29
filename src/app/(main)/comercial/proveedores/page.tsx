"use client";

import { ProveedoresList } from "@/components/comercial/proveedores/proveedores-list";
import { useDataStore } from "@/store/data-store";

export default function ProveedoresPage() {
  const { proveedores } = useDataStore();
  return (
    <ProveedoresList 
      initialProveedores={proveedores}
    />
  );
}
