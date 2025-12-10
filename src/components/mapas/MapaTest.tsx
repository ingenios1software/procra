"use client";

import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LatLngExpression } from 'leaflet';

// Coordenadas del polígono para la parcela PO2
const parcelaCoordinates: LatLngExpression[] = [
  [-24.504275, -55.708025],
  [-24.504714, -55.706622],
  [-24.505438, -55.706427],
  [-24.505606, -55.708151],
  [-24.504275, -55.708025]
];

// Opciones de estilo para el polígono
const parcelaStyle = {
  color: '#3CB371',       // Color del borde
  fillColor: '#3CB371',   // Color de relleno
  fillOpacity: 0.5,      // Opacidad del relleno
  weight: 2              // Grosor del borde
};

export default function MapaTest() {
  const center: LatLngExpression = [-24.5049, -55.7073];

  return (
    <MapContainer center={center} zoom={16} style={{ height: '80vh', width: '100%', borderRadius: '0.5rem' }}>
      <TileLayer
        url="http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
      />
      <Polygon pathOptions={parcelaStyle} positions={parcelaCoordinates}>
        <Popup>
          <div>
            <h3 className="font-bold">PO2 – Soja</h3>
            <p>Superficie: 200 ha</p>
          </div>
        </Popup>
      </Polygon>
    </MapContainer>
  );
}