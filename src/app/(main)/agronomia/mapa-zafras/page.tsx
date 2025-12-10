"use client";

import dynamic from 'next/dynamic';
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
      <div className="w-full h-full">
        <MapaZafras />
      </div>
    </>
  );
}
