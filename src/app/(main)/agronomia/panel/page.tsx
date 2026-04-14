"use client";

import { PanelAgronomico } from "@/components/agronomia/panel/panel-agronomico";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { Parcela, Cultivo, Zafra, Evento, Insumo, EtapaCultivo, RegistroLluviaSector } from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function PanelAgronomicoPage() {
    const tenant = useTenantFirestore();

    const { data: parcelas, isLoading: l1 } = useCollection<Parcela>(useMemoFirebase(() => tenant.query('parcelas', orderBy('nombre')), [tenant]));
    const { data: cultivos, isLoading: l2 } = useCollection<Cultivo>(useMemoFirebase(() => tenant.query('cultivos', orderBy('nombre')), [tenant]));
    const { data: zafras, isLoading: l3 } = useCollection<Zafra>(useMemoFirebase(() => tenant.query('zafras', orderBy('nombre')), [tenant]));
    const { data: eventos, isLoading: l4 } = useCollection<Evento>(useMemoFirebase(() => tenant.query('eventos', orderBy('fecha')), [tenant]));
    const { data: insumos, isLoading: l5 } = useCollection<Insumo>(useMemoFirebase(() => tenant.collection('insumos'), [tenant]));
    const { data: etapas, isLoading: l6 } = useCollection<EtapaCultivo>(useMemoFirebase(() => tenant.collection('etapasCultivo'), [tenant]));
    const { data: lluviasSector, isLoading: l7 } = useCollection<RegistroLluviaSector>(useMemoFirebase(() => tenant.collection('lluviasSector'), [tenant]));

    const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

    if (isLoading) {
        return <p>Cargando datos del panel agronómico...</p>;
    }
    
    return (
        <PanelAgronomico 
            parcelas={parcelas || []}
            cultivos={cultivos || []}
            zafras={zafras || []}
            eventos={eventos || []}
            insumos={insumos || []}
            etapas={etapas || []}
            lluviasSector={lluviasSector || []}
        />
    )
}
