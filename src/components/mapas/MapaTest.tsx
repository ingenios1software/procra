"use client";

import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngExpression, LatLngBounds } from 'leaflet';
import type { Parcela } from '@/lib/types';
import { useMemo, useEffect } from 'react';

// Estilos del polígono de la parcela
const parcelaStyle = {
  color: '#1E90FF',
  fillColor: '#00A86B',
  fillOpacity: 0.35,
  weight: 2,
};

// Componente para ajustar los límites del mapa
const FitBounds = ({ bounds }: { bounds: LatLngBounds | null }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, bounds]);
  return null;
};

interface MapaTestProps {
  parcela: Parcela | null;
}

export default function MapaTest({ parcela }: MapaTestProps) {

  const { polygons, bounds } = useMemo(() => {
    if (!parcela?.geometry) return { polygons: [], bounds: null };
    console.log("COORDS NORMALIZADAS:", parcela.geometry.coordinates[0].slice(0,3));

    const coordinates = parcela.geometry.coordinates;
    let allLatLngs: LatLngExpression[] = [];

    const PolygonsToDraw = (coords: any): LatLngExpression[][] => {
      // Leaflet's Polygon component expects [lat, lng], and our GeoJSON is already in that format. No swap needed.
        if (parcela.geometry?.type === 'Polygon') {
            return [coords[0].map((p: number[]) => [p[1], p[0]])];
        }
        if (parcela.geometry?.type === 'MultiPolygon') {
            return coords.map((poly: any) => poly[0].map((p: number[]) => [p[1], p[0]]));
        }
        return [];
    }

    const drawnPolygons = PolygonsToDraw(coordinates);
    
    drawnPolygons.forEach(poly => {
        allLatLngs = [...allLatLngs, ...poly];
    });

    const leafletBounds = allLatLngs.length > 0 ? new LatLngBounds(allLatLngs as [number, number][]) : null;

    return { polygons: drawnPolygons, bounds: leafletBounds };
  }, [parcela]);


  const center: LatLngExpression = [-25.30066, -57.63591]; // Default center if no data

  return (
    <MapContainer center={center} zoom={13} style={{ height: '80vh', width: '100%', borderRadius: '0.5rem' }}>
      <TileLayer
        url="http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
      />

      {polygons.map((poly, index) => (
        <Polygon key={index} pathOptions={parcelaStyle} positions={poly}>
          <Popup>
            <div>
              <h3 className="font-bold">{parcela?.nombre || 'N/A'}</h3>
              <p>Cultivo: {parcela?.cultivoActual || 'No definido'}</p>
              <p>Superficie: {parcela?.superficie || 0} ha</p>
            </div>
          </Popup>
        </Polygon>
      ))}

      <FitBounds bounds={bounds} />
    </MapContainer>
  );
}
