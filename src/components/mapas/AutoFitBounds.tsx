"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AutoFitBoundsProps {
  bounds: L.LatLngBounds;
}

export const AutoFitBounds = ({ bounds }: AutoFitBoundsProps) => {
  const map = useMap();
  
  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    
    try {
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error("Error fitting bounds:", error);
    }
  }, [map, bounds]);

  return null;
};
