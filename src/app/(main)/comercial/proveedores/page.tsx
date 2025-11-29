"use client";

import { ProveedoresList } from "@/components/comercial/proveedores/proveedores-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Proveedor } from "@/lib/types";

export default function ProveedoresPage() {
  const firestore = useFirestore();
  const proveedoresQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'proveedores'), orderBy('nombre')) : null
  , [firestore]);
  const { data: proveedores, isLoading } = useCollection<Proveedor>(proveedoresQuery);


  return (
    <ProveedoresList proveedores={proveedores || []} isLoading={isLoading}/>
  );
}
