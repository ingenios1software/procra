"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ClienteForm } from "@/components/comercial/clientes/cliente-form";
import { mockClientes } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default function EditarClientePage({ params }: { params: { id: string } }) {
  const cliente = mockClientes.find(c => c.id === params.id);

  if (!cliente) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Cliente"
        description={`Editando los detalles de ${cliente.nombre}.`}
      />
      <ClienteForm cliente={cliente} />
    </>
  );
}
