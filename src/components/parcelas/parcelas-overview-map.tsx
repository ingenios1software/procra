"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Layers3, MapPinned, Search } from "lucide-react";
import { ReportActions } from "@/components/shared/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createMapViewport,
  getGeometryBounds,
  getGeometryCenter,
  getGeometryPolygons,
  projectCoordinate,
  type GeometryBounds,
  type GeometryRing,
  type MapViewport,
} from "@/lib/parcela-mapa";
import type { Parcela } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 780;
const MAP_PADDING = 48;

const ESTADO_META: Record<
  Parcela["estado"],
  {
    label: string;
    fill: string;
    stroke: string;
    badgeClass: string;
  }
> = {
  activa: {
    label: "Activa",
    fill: "rgba(34, 197, 94, 0.22)",
    stroke: "rgba(34, 197, 94, 0.92)",
    badgeClass: "bg-green-600 text-white hover:bg-green-600",
  },
  "en barbecho": {
    label: "En barbecho",
    fill: "rgba(245, 158, 11, 0.24)",
    stroke: "rgba(245, 158, 11, 0.94)",
    badgeClass: "bg-amber-500 text-black hover:bg-amber-500",
  },
  inactiva: {
    label: "Inactiva",
    fill: "rgba(148, 163, 184, 0.20)",
    stroke: "rgba(148, 163, 184, 0.88)",
    badgeClass: "bg-slate-400 text-white hover:bg-slate-400",
  },
};

type ParcelaMapItem = {
  parcela: Parcela;
  polygons: GeometryRing[][];
  bounds: GeometryBounds;
  center: [number, number] | null;
};

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatArea(value: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function buildPolygonPath(polygon: GeometryRing[], viewport: MapViewport) {
  return polygon
    .map((ring) => {
      const commands = ring.map((coordinate, index) => {
        const point = projectCoordinate(coordinate, viewport);
        return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      });
      return `${commands.join(" ")} Z`;
    })
    .join(" ");
}

function mergeBounds(boundsList: GeometryBounds[]): GeometryBounds | null {
  if (boundsList.length === 0) {
    return null;
  }

  const minLng = Math.min(...boundsList.map((item) => item.minLng));
  const maxLng = Math.max(...boundsList.map((item) => item.maxLng));
  const minLat = Math.min(...boundsList.map((item) => item.minLat));
  const maxLat = Math.max(...boundsList.map((item) => item.maxLat));

  return {
    minLng,
    maxLng,
    minLat,
    maxLat,
    width: Math.max(maxLng - minLng, 0.000001),
    height: Math.max(maxLat - minLat, 0.000001),
  };
}

export function ParcelasOverviewMap({ parcelas }: { parcelas: Parcela[] }) {
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<Parcela["estado"] | "todos">("todos");
  const [selectedParcelaId, setSelectedParcelaId] = useState("");

  const filteredParcelas = useMemo(() => {
    const query = normalizeText(search);

    return parcelas.filter((parcela) => {
      if (estado !== "todos" && parcela.estado !== estado) return false;
      if (!query) return true;

      const target = normalizeText(
        `${parcela.nombre} ${parcela.codigo} ${parcela.sector || ""} ${parcela.ubicacion || ""}`
      );
      return target.includes(query);
    });
  }, [estado, parcelas, search]);

  const parcelasConGeometria = useMemo(
    () => filteredParcelas.filter((parcela) => Boolean(parcela.geometry)),
    [filteredParcelas]
  );
  const parcelasSinGeometria = useMemo(
    () => filteredParcelas.filter((parcela) => !parcela.geometry),
    [filteredParcelas]
  );

  const mapItems = useMemo<ParcelaMapItem[]>(() => {
    return parcelasConGeometria
      .map((parcela) => {
        const bounds = getGeometryBounds(parcela.geometry);
        if (!bounds) return null;
        return {
          parcela,
          polygons: getGeometryPolygons(parcela.geometry),
          bounds,
          center: getGeometryCenter(parcela.geometry),
        };
      })
      .filter((item): item is ParcelaMapItem => item !== null);
  }, [parcelasConGeometria]);

  useEffect(() => {
    const selectedExists = filteredParcelas.some((parcela) => parcela.id === selectedParcelaId);
    if (selectedExists) return;
    setSelectedParcelaId(parcelasConGeometria[0]?.id || filteredParcelas[0]?.id || "");
  }, [filteredParcelas, parcelasConGeometria, selectedParcelaId]);

  const selectedParcela =
    filteredParcelas.find((parcela) => parcela.id === selectedParcelaId) ||
    parcelasConGeometria[0] ||
    null;

  const selectedMapItem =
    mapItems.find((item) => item.parcela.id === selectedParcela?.id) || null;

  const aggregateBounds = useMemo(
    () => mergeBounds(mapItems.map((item) => item.bounds)),
    [mapItems]
  );
  const viewport = useMemo(
    () =>
      aggregateBounds
        ? createMapViewport(aggregateBounds, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, MAP_PADDING)
        : null,
    [aggregateBounds]
  );

  const totalSuperficie = useMemo(
    () => filteredParcelas.reduce((sum, parcela) => sum + (Number(parcela.superficie) || 0), 0),
    [filteredParcelas]
  );

  const shareSummary = `Parcelas filtradas: ${filteredParcelas.length} | Con geometria: ${parcelasConGeometria.length} | Sin geometria: ${parcelasSinGeometria.length} | Superficie: ${formatArea(totalSuperficie)} ha.`;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" />
            Mapa General de Parcelas
          </CardTitle>
          <CardDescription>
            Visualice todas las parcelas en un solo mapa, con ajuste automatico de vista y acceso rapido al detalle de cada una.
          </CardDescription>
        </div>
        <ReportActions
          reportTitle="Mapa General de Parcelas"
          reportSummary={shareSummary}
          printTargetId="parcelas-overview-print"
          documentLabel="Mapa General de Parcelas"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Buscar parcela</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, codigo, sector o ubicacion"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Estado</label>
            <Select value={estado} onValueChange={(value) => setEstado(value as Parcela["estado"] | "todos")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activa">Activa</SelectItem>
                <SelectItem value="en barbecho">En barbecho</SelectItem>
                <SelectItem value="inactiva">Inactiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="border-dashed">
            <CardContent className="flex h-full flex-col justify-center p-4">
              <p className="text-sm text-muted-foreground">Parcelas con geometria</p>
              <p className="mt-1 text-2xl font-semibold">{parcelasConGeometria.length}</p>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex h-full flex-col justify-center p-4">
              <p className="text-sm text-muted-foreground">Superficie filtrada</p>
              <p className="mt-1 text-2xl font-semibold">{formatArea(totalSuperficie)} ha</p>
            </CardContent>
          </Card>
        </div>

        <div id="parcelas-overview-print" className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Vista consolidada</CardTitle>
                  <CardDescription>
                    La vista se ajusta automaticamente a las parcelas filtradas que ya tienen geometria cargada.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{filteredParcelas.length} filtradas</Badge>
                  <Badge variant="outline">{parcelasSinGeometria.length} sin geometria</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.values(ESTADO_META).map((meta) => (
                  <Badge key={meta.label} variant="outline" className="gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.stroke }}
                    />
                    {meta.label}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {viewport ? (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
                  <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    className="h-[620px] w-full bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_rgba(2,6,23,1)_55%)]"
                    role="img"
                    aria-label="Mapa general de parcelas"
                  >
                    <rect x={0} y={0} width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#020617" />

                    {Array.from({ length: 9 }).map((_, index) => {
                      const x = (VIEWBOX_WIDTH / 8) * index;
                      return (
                        <line
                          key={`vertical-${index}`}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={VIEWBOX_HEIGHT}
                          stroke="rgba(148,163,184,0.10)"
                        />
                      );
                    })}
                    {Array.from({ length: 7 }).map((_, index) => {
                      const y = (VIEWBOX_HEIGHT / 6) * index;
                      return (
                        <line
                          key={`horizontal-${index}`}
                          x1={0}
                          y1={y}
                          x2={VIEWBOX_WIDTH}
                          y2={y}
                          stroke="rgba(148,163,184,0.10)"
                        />
                      );
                    })}

                    {mapItems.map((item) => {
                      const estadoMeta = ESTADO_META[item.parcela.estado];
                      const isActive = item.parcela.id === selectedParcela?.id;
                      const label = item.parcela.codigo || item.parcela.nombre;

                      return (
                        <g
                          key={item.parcela.id}
                          onClick={() => setSelectedParcelaId(item.parcela.id)}
                          className="cursor-pointer"
                        >
                          {item.polygons.map((polygon, polygonIndex) => (
                            <path
                              key={`${item.parcela.id}-${polygonIndex}`}
                              d={buildPolygonPath(polygon, viewport)}
                              fill={estadoMeta.fill}
                              fillRule="evenodd"
                              stroke={isActive ? "rgba(248,250,252,0.98)" : estadoMeta.stroke}
                              strokeWidth={isActive ? 4.5 : 2.5}
                              strokeLinejoin="round"
                            />
                          ))}
                          {item.center ? (
                            (() => {
                              const point = projectCoordinate(item.center, viewport);
                              return (
                                <>
                                  <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={isActive ? 8 : 6}
                                    fill={isActive ? "rgba(248,250,252,0.98)" : estadoMeta.stroke}
                                  />
                                  <text
                                    x={point.x + 12}
                                    y={point.y - 10}
                                    className={cn(
                                      "fill-slate-50 font-semibold",
                                      isActive ? "text-[22px]" : "text-[18px]"
                                    )}
                                    paintOrder="stroke"
                                    stroke="rgba(2,6,23,0.9)"
                                    strokeWidth={6}
                                  >
                                    {label}
                                  </text>
                                </>
                              );
                            })()
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="flex min-h-[620px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 text-center">
                  <MapPinned className="mb-4 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-xl font-semibold">Todavia no hay parcelas para dibujar</h3>
                  <p className="mt-2 max-w-xl text-muted-foreground">
                    Las parcelas filtradas no tienen geometria cargada. Importe el KML desde el mapa individual de cada parcela para incluirlas aqui.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Parcela seleccionada</CardTitle>
                <CardDescription>
                  Haga click sobre el poligono o sobre una fila para ver su resumen y abrir sus vistas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedParcela ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{selectedParcela.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          Codigo: {selectedParcela.codigo || "-"} | Sector: {selectedParcela.sector || "-"}
                        </p>
                      </div>
                      <Badge className={ESTADO_META[selectedParcela.estado].badgeClass}>
                        {ESTADO_META[selectedParcela.estado].label}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-sm text-muted-foreground">Superficie</p>
                        <p className="mt-1 text-xl font-semibold">{formatArea(selectedParcela.superficie)} ha</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-sm text-muted-foreground">Geometria</p>
                        <p className="mt-1 text-xl font-semibold">
                          {selectedParcela.geometry ? "Cargada" : "Pendiente"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      {selectedMapItem
                        ? "La parcela ya esta incluida en la vista consolidada."
                        : "Esta parcela todavia no aparece en el mapa general porque no tiene geometria cargada."}
                    </div>
                    <div className="no-print flex flex-wrap gap-2">
                      <Button asChild>
                        <Link href={`/parcelas/${selectedParcela.id}`}>Ver reporte</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/parcelas/${selectedParcela.id}/mapa`}>Ver mapa individual</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No hay parcelas para los filtros seleccionados.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Listado filtrado</CardTitle>
                <CardDescription>
                  Seleccione una parcela para resaltarla en el mapa y abrir sus accesos rapidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                  {filteredParcelas.length > 0 ? (
                    filteredParcelas.map((parcela) => {
                      const isActive = parcela.id === selectedParcela?.id;
                      const hasGeometry = Boolean(parcela.geometry);
                      return (
                        <button
                          key={parcela.id}
                          type="button"
                          onClick={() => setSelectedParcelaId(parcela.id)}
                          className={cn(
                            "w-full rounded-xl border p-4 text-left transition-colors",
                            isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-semibold">{parcela.nombre}</p>
                              <p className="text-sm text-muted-foreground">
                                {parcela.codigo || "-"} | {formatArea(parcela.superficie)} ha
                              </p>
                            </div>
                            <Badge variant={hasGeometry ? "secondary" : "outline"}>
                              {hasGeometry ? "En mapa" : "Sin geometria"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Sector: {parcela.sector || "-"}</span>
                            <span>Estado: {ESTADO_META[parcela.estado].label}</span>
                            <span>Ubicacion: {parcela.ubicacion || "-"}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No hay parcelas que coincidan con los filtros actuales.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
