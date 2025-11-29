"use client"

import { PageHeader } from "@/components/shared/page-header";
import { ProveedorForm } from "@/components/comercial/proveedores/proveedor-form";
import { notFound } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import type { Proveedor } from "@/lib/types";

export default function EditarProveedorPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  const proveedorRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'proveedores', params.id) : null
  , [firestore, params.id]);

  const { data: proveedor, isLoading } = useDoc<Proveedor>(proveedorRef);

  if (isLoading) {
    return <div>Cargando proveedor...</div>;
  }

  if (!proveedor) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Proveedor"
        description={`Editando los detalles de ${proveedor.nombre}.`}
      />
      <ProveedorForm proveedor={{...proveedor, id: params.id}} />
    </>
  );
}
