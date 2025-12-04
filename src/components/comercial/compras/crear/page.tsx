"use client"

import { PageHeader } from "@/components/shared/page-header";
import { CompraForm } from "@/components/comercial/compras/compra-form";

export default function CrearCompraPage() {
  return (
    <>
      <PageHeader
        title="Registrar Nueva Compra"
        description="Complete los detalles de la nueva compra de productos o insumos."
      />
      <CompraForm />
    </>
  );
}
