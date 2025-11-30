
"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Zafra } from '@/lib/types';
import { ZafrasList } from "@/components/zafras/zafras-list";

export default function ZafrasPage() {
  const firestore = useFirestore();

  const zafrasQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "zafras"), orderBy("fechaInicio", "desc"));
  }, [firestore]);
  const { data: zafras, isLoading } = useCollection<Zafra>(zafrasQuery);

  return (
    <ZafrasList zafras={zafras || []} isLoading={isLoading} />
  );
}

