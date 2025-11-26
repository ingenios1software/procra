"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";
import { mockProveedores } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default function EditarProveedorPage({ params }: { params: { id: string } }) {
  const proveedor = mockProveedores.find(p => p.id === params.id);

  if (!proveedor) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Proveedor"
        description={`Editando los detalles de ${proveedor.nombre}.`}
      />
      <ProveedorForm proveedor={proveedor} />
    </>
  );
}
