
"use client";

import { InformeCostosParcela } from "@/components/agronomia/informe-costos/informe-costos-parcela";
import { useDataStore } from "@/store/data-store";

export default function InformeCostosParcelaPage() {
    const { parcelas, cultivos, zafras, eventos } = useDataStore();
    
    return (
        <InformeCostosParcela 
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
            eventos={eventos}
        />
    )
}
