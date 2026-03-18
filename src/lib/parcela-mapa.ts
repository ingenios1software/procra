import type { GeoJSONMultiPolygon, GeoJSONPolygon, Parcela } from "@/lib/types";

export type ParcelaMapNote = {
  id: string;
  titulo?: string;
  comentario: string;
  color?: string;
  coordinates: [number, number];
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type ParcelaMapImportMeta = {
  sourceName?: string;
  importedAt?: Date | string;
  polygonCount?: number;
  pointCount?: number;
  placemarkCount?: number;
};

export type ParcelaMapaData = Parcela & {
  mapNotes?: ParcelaMapNote[];
  mapImportMeta?: ParcelaMapImportMeta;
};

export type SupportedParcelaGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export type GeometryRing = [number, number][];

export type GeometryBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  width: number;
  height: number;
};

export type MapViewport = {
  width: number;
  height: number;
  padding: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  bounds: GeometryBounds;
};

export type KmlGeometryParseResult = {
  geometry: SupportedParcelaGeometry;
  polygonCount: number;
  pointCount: number;
  placemarkCount: number;
};

function parseCoordinateTuple(value: string): [number, number] | null {
  const [lngText, latText] = value.trim().split(",");
  const lng = Number(lngText);
  const lat = Number(latText);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
}

function closeRing(ring: GeometryRing): GeometryRing {
  if (ring.length < 3) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  return [...ring, first];
}

function findDescendantsByLocalName(root: Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.localName === localName
  );
}

function extractCoordinatesFromLinearRing(linearRing: Element): GeometryRing {
  const coordinatesNode = findDescendantsByLocalName(linearRing, "coordinates")[0];

  if (!coordinatesNode?.textContent) {
    return [];
  }

  const ring = coordinatesNode.textContent
    .trim()
    .split(/\s+/)
    .map(parseCoordinateTuple)
    .filter((coordinate): coordinate is [number, number] => coordinate !== null);

  const closedRing = closeRing(ring);
  return closedRing.length >= 4 ? closedRing : [];
}

function extractPolygonRings(polygon: Element): GeometryRing[] {
  const rings = findDescendantsByLocalName(polygon, "LinearRing")
    .map(extractCoordinatesFromLinearRing)
    .filter((ring) => ring.length >= 4);

  return rings;
}

export function parseKmlGeometry(kmlText: string): KmlGeometryParseResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];

  if (parserError) {
    throw new Error("El archivo KML no se pudo interpretar.");
  }

  const polygonElements = Array.from(xml.getElementsByTagName("*")).filter(
    (element) => element.localName === "Polygon"
  );
  const polygons = polygonElements
    .map(extractPolygonRings)
    .filter((rings) => rings.length > 0);

  if (polygons.length === 0) {
    throw new Error("El KML no contiene poligonos validos para dibujar la parcela.");
  }

  const geometry: SupportedParcelaGeometry =
    polygons.length === 1
      ? {
          type: "Polygon",
          coordinates: polygons[0].map((ring) =>
            ring.map(([lng, lat]) => [lng, lat])
          ),
        }
      : {
          type: "MultiPolygon",
          coordinates: polygons.map((polygon) =>
            polygon.map((ring) => ring.map(([lng, lat]) => [lng, lat]))
          ),
        };

  const placemarkCount = Array.from(xml.getElementsByTagName("*")).filter(
    (element) => element.localName === "Placemark"
  ).length;
  const pointCount = polygons.reduce(
    (total, polygon) => total + polygon.reduce((ringTotal, ring) => ringTotal + ring.length, 0),
    0
  );

  return {
    geometry,
    polygonCount: polygons.length,
    pointCount,
    placemarkCount: placemarkCount || polygons.length,
  };
}

export function getGeometryPolygons(
  geometry?: SupportedParcelaGeometry | null
): GeometryRing[][] {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return [
      geometry.coordinates.map((ring) =>
        ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number])
      ),
    ];
  }

  return geometry.coordinates.map((polygon) =>
    polygon.map((ring) =>
      ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number])
    )
  );
}

export function getGeometryBounds(
  geometry?: SupportedParcelaGeometry | null
): GeometryBounds | null {
  const polygons = getGeometryPolygons(geometry);
  const points = polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));

  if (points.length === 0) {
    return null;
  }

  const lngValues = points.map(([lng]) => lng);
  const latValues = points.map(([, lat]) => lat);
  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);

  return {
    minLng,
    maxLng,
    minLat,
    maxLat,
    width: Math.max(maxLng - minLng, 0.000001),
    height: Math.max(maxLat - minLat, 0.000001),
  };
}

export function createMapViewport(
  bounds: GeometryBounds,
  width = 1000,
  height = 700,
  padding = 48
): MapViewport {
  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  return {
    width,
    height,
    padding,
    scale,
    offsetX,
    offsetY,
    bounds,
  };
}

export function projectCoordinate(
  coordinate: [number, number],
  viewport: MapViewport
) {
  const [lng, lat] = coordinate;

  return {
    x: viewport.offsetX + (lng - viewport.bounds.minLng) * viewport.scale,
    y: viewport.offsetY + (viewport.bounds.maxLat - lat) * viewport.scale,
  };
}

export function unprojectPoint(
  point: { x: number; y: number },
  viewport: MapViewport
): [number, number] {
  const lng = viewport.bounds.minLng + (point.x - viewport.offsetX) / viewport.scale;
  const lat = viewport.bounds.maxLat - (point.y - viewport.offsetY) / viewport.scale;

  return [lng, lat];
}

export function getGeometryCenter(
  geometry?: SupportedParcelaGeometry | null
): [number, number] | null {
  const bounds = getGeometryBounds(geometry);

  if (!bounds) {
    return null;
  }

  return [
    bounds.minLng + bounds.width / 2,
    bounds.minLat + bounds.height / 2,
  ];
}
