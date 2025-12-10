"use client"

import { useState, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Parcela } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ParcelasLayer } from './ParcelasLayer';
import { Skeleton } from '../ui/skeleton';

export default function MapaZafras() {
  const [selectedZafra, setSelectedZafra] = useState('z2024_25');
  const firestore = useFirestore();

  const parcelasQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'parcelas')) : null
  , [firestore]);
  const { data: parcelas, isLoading } = useCollection<Parcela>(parcelasQuery);

  const zafrasDisponibles = ['z2023_24', 'z2024_25', 'z2025_26'];

  const parcelasParaZafra = useMemo(() => {
    if (!parcelas) return [];
    return parcelas.filter(p => p.zafras && p.zafras[selectedZafra]);
  }, [parcelas, selectedZafra]);

  if (isLoading) {
    return <Skeleton className="w-full h-[85vh] rounded-lg border" />
  }

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-[1000] bg-background/80 p-2 rounded-lg shadow-lg border backdrop-blur-sm">
        <Select onValueChange={setSelectedZafra} defaultValue={selectedZafra}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar Zafra" />
          </SelectTrigger>
          <SelectContent>
            {zafrasDisponibles.map(zafra => (
              <SelectItem key={zafra} value={zafra}>{zafra.replace('_', ' - ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MapContainer 
        center={[-24.5049, -55.7073]} 
        zoom={13} 
        className="w-full h-[85vh] rounded-lg border"
      >
        <TileLayer
          url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
          maxZoom={20}
        />
        <ParcelasLayer parcelas={parcelasParaZafra} zafraKey={selectedZafra} />
      </MapContainer>
    </div>
  );
}
