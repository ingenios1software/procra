"use client";

import { PageHeader } from "@/components/shared/page-header";
import { MaquinariaList } from "@/components/maquinaria/maquinaria-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Maquinaria } from '@/lib/types';


export default function MaquinariaPage() {
  const firestore = useFirestore();
  const maquinariaQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'maquinaria'), orderBy('nombre')) : null, [firestore]);
  const { data: maquinaria, isLoading } = useCollection<Maquinaria>(maquinariaQuery);

  return (
    <>
      <PageHeader
        title="Gestión de Maquinaria"
        description="Administre la flota de vehículos y equipos, y programe mantenimientos."
      />
      <MaquinariaList 
        maquinaria={maquinaria || []}
        isLoading={isLoading}
      />
    </>
  );
}
