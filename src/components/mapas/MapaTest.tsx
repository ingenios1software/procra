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
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds]);
  return null;
};

interface MapaTestProps {
  parcela: Parcela | null;
}

export default function MapaTest({ parcela }: MapaTestProps) {

  const { polygons, bounds } = useMemo(() => {
    if (!parcela?.geometry?.coordinates) {
      return { polygons: [], bounds: null };
    }

    const processCoordinates = (coords: any[]): LatLngExpression[][] => {
      // GeoJSON es [lng, lat], Leaflet espera [lat, lng]. Siempre invertimos.
      if (typeof coords[0][0] === 'number') {
        // Es un simple array de puntos: [lng, lat]
        const inverted = [coords.map(([lng, lat]) => [lat, lng] as LatLngExpression)];
        console.log("COORDS NORMALIZADAS (Polygon):", inverted[0].slice(0,3));
        return inverted;
      }
      // Es un array de polígonos (MultiPolygon)
      const invertedMulti = coords.map(poly => poly.map(([lng, lat]: [number, number]) => [lat, lng] as LatLngExpression));
      console.log("COORDS NORMALIZADAS (MultiPolygon):", invertedMulti[0].slice(0,3));
      return invertedMulti;
    };

    let polygonsToDraw: LatLngExpression[][] = [];
    if (parcela.geometry.type === 'Polygon') {
        polygonsToDraw = processCoordinates(parcela.geometry.coordinates[0]);
    } else if (parcela.geometry.type === 'MultiPolygon') {
        polygonsToDraw = parcela.geometry.coordinates.flatMap(polygonCoords => processCoordinates(polygonCoords[0]));
    }
    
    const allLatLngs = polygonsToDraw.flat();
    const leafletBounds = allLatLngs.length > 0 ? new LatLngBounds(allLatLngs as [number, number][]) : null;

    return { polygons: polygonsToDraw, bounds: leafletBounds };
  }, [parcela]);


  const center: LatLngExpression = [-24.318, -55.729]; // Centro aproximado de Canindeyú

  return (
    <MapContainer center={center} zoom={13} style={{ height: '80vh', width: '100%', borderRadius: '0.5rem' }}>
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
        maxZoom={20}
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
