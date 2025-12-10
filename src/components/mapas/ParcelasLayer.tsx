"use client";

import { useMemo } from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { Parcela } from '@/lib/types';
import { AutoFitBounds } from './AutoFitBounds';

const CULTIVO_COLORS: Record<string, string> = {
  soja: "#6BCB77",
  maíz: "#FFD93D",
  trigo: "#A3B18A",
  default: "#999999",
};

interface ParcelasLayerProps {
  parcelas: Parcela[];
  selectedZafraId?: string;
}

export const ParcelasLayer = ({ parcelas, selectedZafraId }: ParcelasLayerProps) => {
  const zafraKey = selectedZafraId?.replace(/-/g, '_') || '';
  
  const parcelasParaMostrar = useMemo(() => {
    if (!selectedZafraId || !parcelas) return [];
    return parcelas.filter(p => p.zafras && p.zafras[zafraKey] && p.geometria);
  }, [parcelas, selectedZafraId, zafraKey]);
  
  const allBounds = useMemo(() => {
    if (parcelasParaMostrar.length === 0) return [];
    
    const bounds = L.latLngBounds([]);
    parcelasParaMostrar.forEach(p => {
      const coords = p.geometria?.coordinates[0].map(point => [point[1], point[0]] as L.LatLngExpression);
      bounds.extend(coords);
    });
    
    return bounds.isValid() ? bounds : [];
  }, [parcelasParaMostrar]);
  

  return (
    <>
      <AutoFitBounds bounds={allBounds} />
      {parcelasParaMostrar.map((parcela) => {
        const zafraData = parcela.zafras[zafraKey];
        const cultivo = zafraData.cultivo.toLowerCase();
        const color = CULTIVO_COLORS[cultivo] || CULTIVO_COLORS.default;
        
        // Correctamente invirtiendo [lng, lat] a [lat, lng]
        const positions = parcela.geometria.coordinates[0].map(p => [p[1], p[0]] as L.LatLngExpression);

        return (
          <Polygon
            key={parcela.id}
            positions={positions}
            pathOptions={{
              color: '#000000',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.5,
            }}
          >
            <Tooltip sticky>
              <strong>{parcela.nombre}</strong><br />
              Cultivo: {zafraData.cultivo}<br />
              Variedad: {zafraData.variedad}<br />
              Superficie: {zafraData.superficie} ha
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
};
