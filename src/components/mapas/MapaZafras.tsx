"use client";

import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Parcela, Zafra } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { ParcelasLayer } from './ParcelasLayer';

export function MapaZafras() {
  const firestore = useFirestore();
  const [selectedZafra, setSelectedZafra] = useState<string | undefined>(undefined);

  const { data: parcelas, isLoading: loadingParcelas } = useCollection<Parcela>(
    useMemoFirebase(() => firestore ? collection(firestore, 'parcelas') : null, [firestore])
  );
  
  const { data: zafras, isLoading: loadingZafras } = useCollection<Zafra>(
    useMemoFirebase(() => firestore ? collection(firestore, 'zafras') : null, [firestore])
  );
  
  useEffect(() => {
    if (!selectedZafra && zafras && zafras.length > 0) {
      setSelectedZafra(zafras[0].id);
    }
  }, [zafras, selectedZafra]);


  return (
    <>
      <PageHeader
        title="Mapa de Zafras"
        description="Visualización de todas las parcelas y sus cultivos por campaña."
      >
        <div className="w-[200px]">
          <Select onValueChange={setSelectedZafra} value={selectedZafra}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione una zafra..." />
            </SelectTrigger>
            <SelectContent>
              {loadingZafras ? (
                <SelectItem value="loading" disabled>Cargando zafras...</SelectItem>
              ) : (
                zafras?.map((zafra) => (
                  <SelectItem key={zafra.id} value={zafra.id}>
                    {zafra.nombre}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>
      
      <div className="w-full h-[85vh] rounded-lg border">
        <MapContainer center={[-24.5049, -55.7073]} zoom={8} scrollWheelZoom={true} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
            url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          {loadingParcelas ? (
             <p>Cargando parcelas...</p>
          ) : (
             <ParcelasLayer parcelas={parcelas || []} selectedZafraId={selectedZafra} />
          )}
        </MapContainer>
      </div>
    </>
  );
}
