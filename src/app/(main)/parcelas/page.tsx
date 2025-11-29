"use client";

import { ParcelasList } from "@/components/parcelas/parcelas-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';


export default function ParcelasPage() {
  const firestore = useFirestore();
  const parcelasQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null
  , [firestore]);
  const { data: parcelas, isLoading } = useCollection<Parcela>(parcelasQuery);

  return (
    <ParcelasList parcelas={parcelas || []} isLoading={isLoading}/>
  );
}
