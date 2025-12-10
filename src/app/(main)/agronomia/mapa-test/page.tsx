"use client";

import { useState } from "react";
import dynamic from 'next/dynamic';
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import type { Parcela } from "@/lib/types";
import { useEffect } from "react";

// Carga dinámica del componente del mapa para evitar problemas con SSR
const MapaTest = dynamic(() => import('@/components/mapas/MapaTest'), {
  ssr: false,
  loading: () => <Skeleton className="h-[85vh] w-full" />,
});

const PO2_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [
        [
            [-55.73302163315438, -24.31650488227532],
            [-55.73256402806121, -24.31797637242637],
            [-55.73220531582594, -24.3214683424025],
            [-55.73166210816769, -24.32214075435965],
            [-55.73110856129397, -24.32177022327885],
            [-55.72803321222654, -24.31973987026735],
            [-55.72746890920201, -24.31959511215941],
            [-55.72691061728897, -24.31899681921348],
            [-55.72640477708915, -24.31814547644799],
            [-55.72588552860551, -24.31696252162382],
            [-55.72576061016419, -24.31629337053261],
            [-55.72614000632975, -24.31587075094578],
            [-55.72706420371201, -24.31540988956526],
            [-55.72745857810559, -24.3153584633099],
            [-55.72832329314287, -24.31567380474622],
            [-55.7291525967225, -24.31607173477027],
            [-55.73059418201396, -24.31692624369592],
            [-55.73151022756431, -24.31726591876828],
            [-55.7324476855697, -24.3168953979746],
            [-55.73302163315438, -24.31650488227532]
        ]
    ]
};


export default function MapaTestPage() {
  const firestore = useFirestore();

  const parcelaRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'parcelas', 'PO2') : null
  , [firestore]);

  const { data: parcela, isLoading } = useDoc<Parcela>(parcelaRef);

  // Asegurarse de que la parcela de prueba exista
  useEffect(() => {
    if (!isLoading && !parcela && firestore) {
      const createTestParcela = async () => {
        const testParcelaData = {
          nombre: "Parcela de Prueba",
          codigo: "PO2",
          superficie: 200,
          estado: "activa",
          ubicacion: "Canindeyú",
          cultivoActual: "Soja",
          geometry: PO2_GEOMETRY
        };
        await setDoc(doc(firestore, 'parcelas', 'PO2'), testParcelaData);
      };
      createTestParcela();
    }
  }, [isLoading, parcela, firestore]);

  if (isLoading) {
    return <Skeleton className="h-[85vh] w-full" />
  }

  return (
    <>
      <PageHeader
        title="Mapa Test – Parcela PO2"
        description="Visualización de una única parcela cargada desde Firestore."
      />
      {parcela ? <MapaTest parcela={parcela} /> : <p>Creando parcela de prueba...</p>}
    </>
  );
}
