"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ClienteForm } from "@/components/comercial/clientes/cliente-form";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from 'firebase/firestore';
import { notFound } from "next/navigation";
import type { Cliente } from '@/lib/types';


export default function EditarClientePage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  
  const clienteRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'clientes', params.id);
  }, [firestore, params.id]);

  const { data: cliente, isLoading } = useDoc<Cliente>(clienteRef);

  if (isLoading) {
    return <div>Cargando cliente...</div>
  }
  
  if (!cliente) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Cliente"
        description={`Editando los detalles de ${cliente.nombre}.`}
      />
      <ClienteForm cliente={{...cliente, id: params.id}} />
    </>
  );
}
