"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

interface AutoFitBoundsProps {
  polygons: LatLngExpression[][];
}

export function AutoFitBounds({ polygons }: AutoFitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (polygons.length === 0) return;

    const allPoints = polygons.flat();
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints as L.LatLngExpression[]);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [polygons, map]);

  return null;
}
