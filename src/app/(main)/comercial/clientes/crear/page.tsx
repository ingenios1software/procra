"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ClienteForm } from "@/components/comercial/clientes/cliente-form";

export default function CrearClientePage() {
  return (
    <>
      <PageHeader
        title="Crear Nuevo Cliente"
        description="Complete los detalles del nuevo cliente."
      />
      <ClienteForm />
    </>
  );
}
