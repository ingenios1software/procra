"use client";

import { PanelAgronomico } from "@/components/agronomia/panel/panel-agronomico";
import { useDataStore } from "@/store/data-store";

export default function PanelAgronomicoPage() {
    const { parcelas, cultivos, zafras, eventos, insumos, etapasCultivo } = useDataStore();

    return (
        <PanelAgronomico 
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
            eventos={eventos}
            insumos={insumos}
            etapas={etapasCultivo}
        />
    )
}
