"use client";

import { CultivosList } from "@/components/cultivos/cultivos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Cultivo } from '@/lib/types';


export default function CultivosPage() {
  const firestore = useFirestore();

  const cultivosQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null
  , [firestore]);
  const { data: cultivos, isLoading } = useCollection<Cultivo>(cultivosQuery);

  return (
    <>
      <CultivosList
        initialCultivos={cultivos || []}
        isLoading={isLoading}
      />
    </>
  );
}
