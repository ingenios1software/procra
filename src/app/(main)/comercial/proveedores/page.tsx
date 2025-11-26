
"use client";

import { ProveedoresList } from "@/components/comercial/proveedores/proveedores-list";
import { mockProveedores } from "@/lib/mock-data";

export default function ProveedoresPage() {
  return (
    <ProveedoresList 
      initialProveedores={mockProveedores}
    />
  );
}
