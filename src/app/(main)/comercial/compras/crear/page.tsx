"use client"

import { PageHeader } from "@/components/shared/page-header";
import { CompraForm } from "@/components/comercial/compras/compra-form";
import { mockProveedores, mockInsumos, mockParcelas, mockZafras } from "@/lib/mock-data";

export default function CrearCompraPage() {
  return (
    <>
      <PageHeader
        title="Crear Nueva Compra"
        description="Complete los detalles de la nueva compra de productos o insumos."
      />
      <CompraForm 
        proveedores={mockProveedores}
        insumos={mockInsumos}
        parcelas={mockParcelas}
        zafras={mockZafras}
      />
    </>
  );
}
