"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from '@/components/ui/skeleton';

const MapaZafras = dynamic(
  () => import('@/components/mapas/MapaZafras').then((mod) => mod.MapaZafras),
  { 
    loading: () => <Skeleton className="w-full h-[85vh]" />,
    ssr: false 
  }
);

export default function MapaZafrasPage() {
  return (
    <>
      <PageHeader
        title="Mapa de Zafras"
        description="Visualización de todas las parcelas y sus cultivos por campaña."
      />
      <div className="w-full h-[85vh] rounded-lg border">
        <MapaZafras />
      </div>
    </>
  );
}
