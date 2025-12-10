"use client";

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from '@/components/ui/skeleton';
import { useDoc, useFirestore, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Carga dinámica del componente del mapa para evitar problemas con SSR
const MapaTest = dynamic(() => import('@/components/mapas/MapaTest'), {
  ssr: false,
  loading: () => <Skeleton className="h-[80vh] w-full" />,
});

const PO2_ID = "PO2";
const parcelaDePrueba: Omit<Parcela, 'id'> = {
    nombre: "Parcela de Prueba 2",
    codigo: "PO2",
    superficie: 200,
    ubicacion: "Región de prueba",
    estado: "activa",
    sector: "Pruebas",
    cultivoActual: "Soja",
    geometry: {
        type: "Polygon",
        coordinates: [
            [
                [-55.708025, -24.504275],
                [-55.706622, -24.504714],
                [-55.706427, -24.505438],
                [-55.708151, -24.505606],
                [-55.708025, -24.504275]
            ]
        ]
    }
};

export default function MapaTestPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const parcelaRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'parcelas', PO2_ID) : null
  , [firestore]);
  
  const { data: parcela, isLoading } = useDoc<Parcela>(parcelaRef);

  // Efecto para crear el documento de prueba si no existe
  useEffect(() => {
    if (!isLoading && !parcela && firestore) {
      const crearParcelaDePrueba = async () => {
        try {
          await setDoc(doc(firestore, 'parcelas', PO2_ID), parcelaDePrueba);
          toast({
            title: "Parcela de prueba creada",
            description: "Se creó la parcela PO2 en Firestore para la demostración.",
          });
        } catch (error) {
          console.error("Error creando parcela de prueba:", error);
           toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo crear la parcela de prueba.",
          });
        }
      };
      crearParcelaDePrueba();
    }
  }, [isLoading, parcela, firestore, toast]);

  return (
    <>
      <PageHeader
        title="Mapa Test – Parcela PO2"
        description="Visualización de una única parcela de prueba (PO2) en el mapa satelital, cargada desde Firestore."
      />
      {isLoading ? (
         <Skeleton className="h-[80vh] w-full" />
      ) : (
        <MapaTest parcela={parcela} />
      )}
    </>
  );
}
