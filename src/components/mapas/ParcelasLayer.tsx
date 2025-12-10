"use client";

import { Polygon, Tooltip } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import type { Parcela } from '@/lib/types';
import { AutoFitBounds } from './AutoFitBounds';

interface ParcelasLayerProps {
  parcelas: Parcela[];
  zafraKey: string;
}

const CULTIVO_COLORS: { [key: string]: string } = {
  soja: "#6BCB77",
  maíz: "#FFD93D",
  trigo: "#A3B18A",
  default: "#999999",
};

export function ParcelasLayer({ parcelas, zafraKey }: ParcelasLayerProps) {
  const allPolygons: LatLngExpression[][] = [];

  const parcelasParaMostrar = parcelas.map(parcela => {
    if (!parcela.geometry?.coordinates) return null;
    
    // Invertir coordenadas de [lng, lat] a [lat, lng]
    const leafletCoords: LatLngExpression[] = parcela.geometry.coordinates[0].map(p => [p[1], p[0]]);
    allPolygons.push(leafletCoords);

    const zafraData = parcela.zafras?.[zafraKey];
    if (!zafraData) return null;

    const cultivoKey = zafraData.cultivo.toLowerCase();
    const color = CULTIVO_COLORS[cultivoKey] || CULTIVO_COLORS.default;

    return (
      <Polygon
        key={parcela.id}
        positions={leafletCoords}
        pathOptions={{
          color: '#000000',
          weight: 1,
          fillColor: color,
          fillOpacity: 0.6,
        }}
      >
        <Tooltip direction="center" permanent className="bg-transparent border-none shadow-none text-white font-bold">
          <div>{parcela.nombre}</div>
          <div className="text-xs">{zafraData.cultivo}</div>
        </Tooltip>
      </Polygon>
    );
  }).filter(Boolean);

  return (
    <>
      {parcelasParaMostrar}
      <AutoFitBounds polygons={allPolygons} />
    </>
  );
}
