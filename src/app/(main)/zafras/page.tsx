"use client";

import { ZafrasList } from "@/components/zafras/zafras-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Zafra } from '@/lib/types';


export default function ZafrasPage() {
  const firestore = useFirestore();

  const zafrasQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'zafras'), orderBy('fechaInicio', 'desc')) : null
  , [firestore]);
  const { data: zafras, isLoading } = useCollection<Zafra>(zafrasQuery);

  return (
    <ZafrasList 
      initialZafras={zafras || []}
      isLoading={isLoading}
    />
  );
}
