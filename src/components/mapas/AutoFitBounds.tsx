"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AutoFitBoundsProps {
  bounds: L.LatLngBoundsExpression;
}

export const AutoFitBounds = ({ bounds }: AutoFitBoundsProps) => {
  const map = useMap();
  
  useEffect(() => {
    if (!bounds || (Array.isArray(bounds) && bounds.length === 0)) return;
    
    try {
      const latLngBounds = L.latLngBounds(bounds);
      if (latLngBounds.isValid()) {
        map.fitBounds(latLngBounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error("Error fitting bounds:", error);
    }
  }, [map, bounds]);

  return null;
};
