"use client";

import { PanelAgronomico } from "@/components/agronomia/panel/panel-agronomico";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, EtapaCultivo } from "@/lib/types";

export default function PanelAgronomicoPage() {
    const firestore = useFirestore();

    const parcelasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'parcelas'), orderBy('nombre')) : null, [firestore]);
    const { data: parcelas, isLoading: loadingParcelas } = useCollection<Parcela>(parcelasQuery);

    const cultivosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'cultivos'), orderBy('nombre')) : null, [firestore]);
    const { data: cultivos, isLoading: loadingCultivos } = useCollection<Cultivo>(cultivosQuery);

    const zafrasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zafras'), orderBy('nombre')) : null, [firestore]);
    const { data: zafras, isLoading: loadingZafras } = useCollection<Zafra>(zafrasQuery);

    const eventosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos'), orderBy('fecha')) : null, [firestore]);
    const { data: eventos, isLoading: loadingEventos } = useCollection<Evento>(eventosQuery);

    const insumosQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos'), orderBy('nombre')) : null, [firestore]);
    const { data: insumos, isLoading: loadingInsumos } = useCollection<Insumo>(insumosQuery);

    const etapasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'etapasCultivo'), orderBy('orden')) : null, [firestore]);
    const { data: etapasCultivo, isLoading: loadingEtapas } = useCollection<EtapaCultivo>(etapasQuery);

    const isLoading = loadingParcelas || loadingCultivos || loadingZafras || loadingEventos || loadingInsumos || loadingEtapas;

    if (isLoading) {
        return <p>Cargando datos del panel...</p>;
    }

    return (
        <PanelAgronomico 
            parcelas={parcelas || []}
            cultivos={cultivos || []}
            zafras={zafras || []}
            eventos={eventos || []}
            insumos={insumos || []}
            etapas={etapasCultivo || []}
        />
    )
}
