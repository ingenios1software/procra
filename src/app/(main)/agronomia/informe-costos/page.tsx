"use client";

import { InformeCostosParcela } from "@/components/agronomia/informe-costos/informe-costos-parcela";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Parcela, Cultivo, Zafra, Evento, Insumo } from "@/lib/types";

export default function InformeCostosPage() {
    const firestore = useFirestore();

    const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]));
    const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null, [firestore]));
    const { data: zafras, isLoading: l3 } = useCollection<Zafra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]));
    const { data: eventos, isLoading: l4 } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha')) : null, [firestore]));
    const { data: insumos, isLoading: l5 } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos')) : null, [firestore]));

    const isLoading = l1 || l2 || l3 || l4 || l5;

    if (isLoading) {
        return <p>Cargando datos del informe de costos...</p>;
    }
    
    return (
        <InformeCostosParcela
            parcelas={parcelas || []}
            cultivos={cultivos || []}
            zafras={zafras || []}
            eventos={eventos || []}
            insumos={insumos || []}
        />
    )
}
