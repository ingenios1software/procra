"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import { notFound } from "next/navigation";
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';
import { useMemo } from 'react';

export default function EditarParcelaPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  
  const parcelaRef = useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'parcelas', params.id);
  }, [firestore, params.id]);

  const { data: parcela, isLoading } = useDoc<Parcela>(parcelaRef);


  if (isLoading) {
    return <div>Cargando...</div>;
  }

  if (!parcela) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Parcela"
        description={`Editando los detalles de ${parcela.nombre}.`}
      />
      <ParcelaForm parcela={parcela} />
    </>
  );
}
