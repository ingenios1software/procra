"use client"

import { PageHeader } from "@/components/shared/page-header";
import { CompraForm } from "@/components/comercial/compras/compra-form";
import { useDataStore } from "@/store/data-store";

export default function CrearCompraPage() {
  const { proveedores, insumos, parcelas, zafras } = useDataStore();
  return (
    <>
      <PageHeader
        title="Crear Nueva Compra"
        description="Complete los detalles de la nueva compra de productos o insumos."
      />
      <CompraForm 
        proveedores={proveedores}
        insumos={insumos}
        parcelas={parcelas}
        zafras={zafras}
      />
    </>
  );
}
