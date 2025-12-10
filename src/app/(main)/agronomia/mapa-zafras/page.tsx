"use client";

import { useState } from "react";
import dynamic from 'next/dynamic';
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Carga dinámica del componente del mapa para evitar problemas con SSR
const MapaZafras = dynamic(() => import('@/components/mapas/MapaZafras'), {
  ssr: false,
  loading: () => <Skeleton className="h-[85vh] w-full" />,
});

export default function MapaZafrasPage() {
  return (
    <>
      <PageHeader
        title="Mapa de Zafras"
        description="Visualización de todas las parcelas y sus cultivos por campaña."
      />
      <MapaZafras />
    </>
  );
}
