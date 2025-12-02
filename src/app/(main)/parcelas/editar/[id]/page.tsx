"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "@/components/parcelas/parcela-form";
import { notFound } from "next/navigation";
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';
import { useMemo } from 'react';

export default function EditarParcelaPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();
  const { id } = params;
  
  const parcelaRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'parcelas', id);
  }, [firestore, id]);

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
      <ParcelaForm parcela={{...parcela, id: id}} />
    </>
  );
}
