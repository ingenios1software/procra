"use client";

import { DepositosList } from "@/components/maestros/depositos/depositos-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Deposito } from '@/lib/types';


export default function DepositosPage() {
  const firestore = useFirestore();

  const depositosQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'depositos'), orderBy('nombre')) : null
  , [firestore]);
  const { data: depositos, isLoading, forceRefetch } = useCollection<Deposito>(depositosQuery);

  return (
    <DepositosList
      initialDepositos={depositos || []}
      isLoading={isLoading}
      onDataChange={forceRefetch}
    />
  );
}

    