"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";
import { useDataStore } from "@/store/data-store";
import { notFound } from "next/navigation";

export default function EditarProveedorPage({ params }: { params: { id: string } }) {
  const { proveedores } = useDataStore();
  const proveedor = proveedores.find(p => p.id === params.id);

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
