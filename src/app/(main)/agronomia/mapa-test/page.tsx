"use client";

import dynamic from 'next/dynamic';
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from '@/components/ui/skeleton';

// Carga dinámica del componente del mapa para evitar problemas con SSR
const MapaTest = dynamic(() => import('@/components/mapas/MapaTest'), {
  ssr: false,
  loading: () => <Skeleton className="h-[80vh] w-full" />,
});

export default function MapaTestPage() {
  return (
    <>
      <PageHeader
        title="Mapa Test – Parcela PO2"
        description="Visualización de una única parcela de prueba (PO2) en el mapa satelital."
      />
      <MapaTest />
    </>
  );
}