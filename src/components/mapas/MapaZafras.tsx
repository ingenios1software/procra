"use client"

import { useState, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Parcela, Zafra } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ParcelasLayer } from './ParcelasLayer';
import { Skeleton } from '../ui/skeleton';

export default function MapaZafras() {
  const [selectedZafra, setSelectedZafra] = useState<string | undefined>(undefined);
  const firestore = useFirestore();

  const parcelasQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'parcelas')) : null
  , [firestore]);
  const { data: parcelas, isLoading: isLoadingParcelas } = useCollection<Parcela>(parcelasQuery);

  const zafrasQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'zafras')) : null
  , [firestore]);
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(zafrasQuery);

  // Set default zafra once loaded
  useState(() => {
    if (!selectedZafra && zafras && zafras.length > 0) {
      setSelectedZafra(zafras[0].id);
    }
  });
  
  const parcelasParaZafra = useMemo(() => {
    if (!parcelas || !selectedZafra) return [];
    // Key de zafra para el objeto anidado en parcela es el nombre, no el id. Ej: "z2024_25"
    const zafraSeleccionada = zafras?.find(z => z.id === selectedZafra);
    if (!zafraSeleccionada) return [];
    const zafraKey = zafraSeleccionada.nombre.replace(' - ', '_');
    
    return parcelas.filter(p => p.zafras && p.zafras[zafraKey]);
  }, [parcelas, selectedZafra, zafras]);

  const zafraKey = useMemo(() => {
      const zafraSeleccionada = zafras?.find(z => z.id === selectedZafra);
      if (!zafraSeleccionada) return '';
      return zafraSeleccionada.nombre.replace(' - ', '_');
  }, [selectedZafra, zafras]);

  if (isLoadingParcelas || isLoadingZafras) {
    return <Skeleton className="w-full h-[85vh] rounded-lg border" />
  }

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-[1000] bg-background/80 p-2 rounded-lg shadow-lg border backdrop-blur-sm">
        <Select onValueChange={setSelectedZafra} value={selectedZafra}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar Zafra" />
          </SelectTrigger>
          <SelectContent>
            {zafras?.map(zafra => (
              <SelectItem key={zafra.id} value={zafra.id}>{zafra.nombre}</SelectItem>
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
        <ParcelasLayer parcelas={parcelasParaZafra} zafraKey={zafraKey} />
      </MapContainer>
    </div>
  );
}
