"use client";

import { ClientesList } from "@/components/comercial/clientes/clientes-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import type { Cliente } from '@/lib/types';


export default function ClientesPage() {
  const firestore = useFirestore();
  const clientesQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'clientes'), orderBy('nombre')) : null
  , [firestore]);
  const { data: clientes, isLoading } = useCollection<Cliente>(clientesQuery);

  return (
    <ClientesList clientes={clientes || []} isLoading={isLoading}/>
  );
}
