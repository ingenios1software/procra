"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";

export default function CrearProveedorPage() {
  return (
    <>
      <PageHeader
        title="Crear Nuevo Proveedor"
        description="Complete los detalles del nuevo proveedor."
      />
      <ProveedorForm />
    </>
  );
}
