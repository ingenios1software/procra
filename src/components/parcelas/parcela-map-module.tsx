"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  Crosshair,
  FileUp,
  MapPinned,
  MessageSquarePlus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import {
  createMapViewport,
  getGeometryBounds,
  getGeometryCenter,
  getGeometryPolygons,
  parseKmlGeometry,
  projectCoordinate,
  unprojectPoint,
  type GeometryRing,
  type MapViewport,
  type ParcelaMapImportMeta,
  type ParcelaMapNote,
  type ParcelaMapaData,
  type SupportedParcelaGeometry,
} from "@/lib/parcela-mapa";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 700;
const MAP_PADDING = 48;
const DEFAULT_NOTE_COLOR = "#f97316";
const NOTE_COLORS = [
  "#f97316",
  "#16a34a",
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#0f766e",
];

type NoteEditorState = {
  mode: "create" | "edit";
  id: string;
  titulo: string;
  comentario: string;
  color: string;
  coordinates: [number, number];
  createdAt?: Date | string;
};

interface ParcelaMapModuleProps {
  parcela: ParcelaMapaData;
}

function createNoteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function formatDateTime(value?: unknown) {
  if (!value) {
    return "Sin registro";
  }

  const timestampCandidate =
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate()
      : value;
  const date =
    timestampCandidate instanceof Date
      ? timestampCandidate
      : new Date(timestampCandidate as string | number);
  if (Number.isNaN(date.getTime())) {
    return "Sin registro";
  }

  return date.toLocaleString("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildPolygonPath(polygon: GeometryRing[], viewport: MapViewport) {
  return polygon
    .map((ring) => {
      const commands = ring.map((coordinate, index) => {
        const point = projectCoordinate(coordinate, viewport);
        const prefix = index === 0 ? "M" : "L";
        return `${prefix} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      });

      return `${commands.join(" ")} Z`;
    })
    .join(" ");
}

export function ParcelaMapModule({ parcela }: ParcelaMapModuleProps) {
  const tenant = useTenantFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parcelaRef = tenant.doc("parcelas", parcela.id);
  const [geometryPreview, setGeometryPreview] = useState<SupportedParcelaGeometry | null>(
    parcela.geometry ?? null
  );
  const [importMetaPreview, setImportMetaPreview] = useState<ParcelaMapImportMeta | null>(
    parcela.mapImportMeta ?? null
  );
  const [localNotes, setLocalNotes] = useState<ParcelaMapNote[]>(parcela.mapNotes ?? []);
  const [isImporting, setIsImporting] = useState(false);
  const [isPlacingNote, setIsPlacingNote] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);

  useEffect(() => {
    setGeometryPreview(parcela.geometry ?? null);
  }, [parcela.geometry, parcela.id]);

  useEffect(() => {
    setImportMetaPreview(parcela.mapImportMeta ?? null);
  }, [parcela.id, parcela.mapImportMeta]);

  useEffect(() => {
    setLocalNotes(parcela.mapNotes ?? []);
  }, [parcela.id, parcela.mapNotes]);

  const geometry = geometryPreview ?? parcela.geometry ?? null;
  const polygons = useMemo(() => getGeometryPolygons(geometry), [geometry]);
  const bounds = useMemo(() => getGeometryBounds(geometry), [geometry]);
  const viewport = useMemo(
    () =>
      bounds
        ? createMapViewport(bounds, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, MAP_PADDING)
        : null,
    [bounds]
  );
  const center = useMemo(() => getGeometryCenter(geometry), [geometry]);
  const totalNotes = localNotes.length;

  const beginNotePlacement = () => {
    if (!viewport) {
      toast({
        variant: "destructive",
        title: "Importe un KML primero",
        description: "Necesitamos la geometria de la parcela para ubicar notas sobre el mapa.",
      });
      return;
    }

    setSelectedNoteId(null);
    setNoteEditor(null);
    setIsPlacingNote(true);
  };

  const openExistingNote = (note: ParcelaMapNote) => {
    setIsPlacingNote(false);
    setSelectedNoteId(note.id);
    setNoteEditor({
      mode: "edit",
      id: note.id,
      titulo: note.titulo ?? "",
      comentario: note.comentario,
      color: note.color ?? DEFAULT_NOTE_COLOR,
      coordinates: note.coordinates,
      createdAt: note.createdAt,
    });
  };

  const resetEditor = () => {
    setIsPlacingNote(false);
    setSelectedNoteId(null);
    setNoteEditor(null);
  };

  const persistNotes = (nextNotes: ParcelaMapNote[], successMessage: string) => {
    if (!parcelaRef) {
      return;
    }

    setLocalNotes(nextNotes);
    updateDocumentNonBlocking(parcelaRef, { mapNotes: nextNotes });
    toast({
      title: "Mapa actualizado",
      description: successMessage,
    });
  };

  const handleSaveNote = () => {
    if (!noteEditor) {
      return;
    }

    const comentario = noteEditor.comentario.trim();
    const titulo = noteEditor.titulo.trim();

    if (!comentario) {
      toast({
        variant: "destructive",
        title: "Comentario requerido",
        description: "Escriba una observacion para guardar la anotacion.",
      });
      return;
    }

    const now = new Date().toISOString();
    const nextNote: ParcelaMapNote = {
      id: noteEditor.id,
      titulo: titulo || undefined,
      comentario,
      color: noteEditor.color || DEFAULT_NOTE_COLOR,
      coordinates: noteEditor.coordinates,
      createdAt: noteEditor.createdAt || now,
      updatedAt: now,
    };

    const nextNotes =
      noteEditor.mode === "create"
        ? [...localNotes, nextNote]
        : localNotes.map((note) => (note.id === nextNote.id ? nextNote : note));

    persistNotes(
      nextNotes,
      noteEditor.mode === "create"
        ? "La anotacion fue agregada al mapa."
        : "La anotacion fue actualizada."
    );
    setSelectedNoteId(nextNote.id);
    setNoteEditor({
      mode: "edit",
      id: nextNote.id,
      titulo: nextNote.titulo ?? "",
      comentario: nextNote.comentario,
      color: nextNote.color ?? DEFAULT_NOTE_COLOR,
      coordinates: nextNote.coordinates,
      createdAt: nextNote.createdAt,
    });
    setIsPlacingNote(false);
  };

  const handleDeleteNote = () => {
    if (!noteEditor || noteEditor.mode !== "edit") {
      return;
    }

    const nextNotes = localNotes.filter((note) => note.id !== noteEditor.id);
    persistNotes(nextNotes, "La anotacion fue eliminada.");
    resetEditor();
  };

  const handleMapClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!isPlacingNote || !viewport) {
      if (!isPlacingNote) {
        setSelectedNoteId(null);
      }
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
    const coordinates = unprojectPoint({ x, y }, viewport);

    setNoteEditor({
      mode: "create",
      id: createNoteId(),
      titulo: "",
      comentario: "",
      color: DEFAULT_NOTE_COLOR,
      coordinates,
    });
    setSelectedNoteId(null);
    setIsPlacingNote(false);
  };

  const handleImportKml = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !parcelaRef) {
      return;
    }

    setIsImporting(true);

    try {
      const content = await file.text();
      const parsed = parseKmlGeometry(content);
      const importedAt = new Date().toISOString();
      const nextMeta: ParcelaMapImportMeta = {
        sourceName: file.name,
        importedAt,
        polygonCount: parsed.polygonCount,
        pointCount: parsed.pointCount,
        placemarkCount: parsed.placemarkCount,
      };

      setGeometryPreview(parsed.geometry);
      setImportMetaPreview(nextMeta);
      updateDocumentNonBlocking(parcelaRef, {
        geometry: parsed.geometry,
        mapImportMeta: nextMeta,
      });
      toast({
        title: "KML importado",
        description: `Se actualizo el mapa de ${parcela.nombre} con ${parsed.polygonCount} poligono(s).`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo procesar el archivo KML.";

      toast({
        variant: "destructive",
        title: "Error al importar KML",
        description: message,
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const selectedNote = localNotes.find((note) => note.id === selectedNoteId) ?? null;
  const activePreviewNote: NoteEditorState | null =
    noteEditor ??
    (selectedNote
      ? {
          mode: "edit",
          id: selectedNote.id,
          titulo: selectedNote.titulo ?? "",
          comentario: selectedNote.comentario,
          color: selectedNote.color ?? DEFAULT_NOTE_COLOR,
          coordinates: selectedNote.coordinates,
          createdAt: selectedNote.createdAt,
        }
      : null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-primary" />
                Mapa de la parcela
              </CardTitle>
              <CardDescription>
                Importe un archivo KML para dibujar la parcela y agregue puntos con comentarios sobre el mapa.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml"
                className="hidden"
                onChange={handleImportKml}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileUp className="h-4 w-4" />
                {isImporting
                  ? "Procesando KML..."
                  : geometry
                    ? "Reemplazar KML"
                    : "Importar KML"}
              </Button>
              <Button
                onClick={beginNotePlacement}
                disabled={!geometry}
                className={cn(isPlacingNote && "bg-amber-600 hover:bg-amber-500")}
              >
                <MessageSquarePlus className="h-4 w-4" />
                {isPlacingNote ? "Haga click en el mapa" : "Agregar anotacion"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={geometry ? "secondary" : "outline"}>
              {geometry ? "KML cargado" : "Sin geometria"}
            </Badge>
            <Badge variant="outline">{totalNotes} anotacion(es)</Badge>
            {importMetaPreview?.sourceName ? (
              <Badge variant="outline">{importMetaPreview.sourceName}</Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {viewport ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
              <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className={cn(
                  "h-[520px] w-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_rgba(2,6,23,1)_55%)]",
                  isPlacingNote ? "cursor-crosshair" : "cursor-default"
                )}
                onClick={handleMapClick}
                role="img"
                aria-label={`Mapa de la parcela ${parcela.nombre}`}
              >
                <rect
                  x={0}
                  y={0}
                  width={VIEWBOX_WIDTH}
                  height={VIEWBOX_HEIGHT}
                  fill="#020617"
                />

                {Array.from({ length: 7 }).map((_, index) => {
                  const x = (VIEWBOX_WIDTH / 6) * index;
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
                {Array.from({ length: 6 }).map((_, index) => {
                  const y = (VIEWBOX_HEIGHT / 5) * index;
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

                {polygons.map((polygon, index) => (
                  <path
                    key={`polygon-${index}`}
                    d={buildPolygonPath(polygon, viewport)}
                    fill="rgba(56,189,248,0.18)"
                    fillRule="evenodd"
                    stroke="rgba(125,211,252,0.92)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                ))}

                {center ? (
                  (() => {
                    const point = projectCoordinate(center, viewport);
                    return (
                      <text
                        x={point.x}
                        y={point.y}
                        textAnchor="middle"
                        className="fill-slate-100 text-[28px] font-bold tracking-[0.08em]"
                        paintOrder="stroke"
                        stroke="rgba(2,6,23,0.86)"
                        strokeWidth={8}
                      >
                        {parcela.nombre}
                      </text>
                    );
                  })()
                ) : null}

                {localNotes.map((note, index) => {
                  const point = projectCoordinate(note.coordinates, viewport);
                  const color = note.color ?? DEFAULT_NOTE_COLOR;
                  const isActive = note.id === selectedNoteId || note.id === noteEditor?.id;
                  const title = note.titulo || `Nota ${index + 1}`;

                  return (
                    <g
                      key={note.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openExistingNote(note);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isActive ? 18 : 14}
                        fill="transparent"
                        stroke={color}
                        strokeDasharray="4 5"
                        strokeWidth={isActive ? 3 : 2}
                        opacity={0.6}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isActive ? 10 : 8}
                        fill={color}
                        stroke="rgba(248,250,252,0.95)"
                        strokeWidth={3}
                      />
                      <text
                        x={point.x + 16}
                        y={point.y - 16}
                        className="fill-slate-50 text-[20px] font-semibold"
                        paintOrder="stroke"
                        stroke="rgba(2,6,23,0.92)"
                        strokeWidth={6}
                      >
                        {title}
                      </text>
                    </g>
                  );
                })}

                {noteEditor?.mode === "create" ? (
                  (() => {
                    const draftPoint = projectCoordinate(noteEditor.coordinates, viewport);
                    return (
                      <g pointerEvents="none">
                        <circle
                          cx={draftPoint.x}
                          cy={draftPoint.y}
                          r={22}
                          fill="transparent"
                          stroke={noteEditor.color}
                          strokeDasharray="5 5"
                          strokeWidth={3}
                        />
                        <circle
                          cx={draftPoint.x}
                          cy={draftPoint.y}
                          r={10}
                          fill={noteEditor.color}
                          stroke="white"
                          strokeWidth={3}
                        />
                      </g>
                    );
                  })()
                ) : null}
              </svg>
            </div>
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 text-center">
              <MapPinned className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="text-xl font-semibold">Todavia no hay un mapa cargado</h3>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Suba un archivo KML de la parcela para visualizar su contorno, ubicar referencias
                en el terreno y guardar comentarios directamente sobre el mapa.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="bg-muted/35 shadow-none hover:shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Poligonos</p>
                <p className="mt-2 text-2xl font-bold">
                  {importMetaPreview?.polygonCount ?? polygons.length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/35 shadow-none hover:shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Puntos del contorno</p>
                <p className="mt-2 text-2xl font-bold">
                  {importMetaPreview?.pointCount ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/35 shadow-none hover:shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Anotaciones</p>
                <p className="mt-2 text-2xl font-bold">{totalNotes}</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumen del mapa</CardTitle>
            <CardDescription>
              Ultima importacion y datos base de la geometria cargada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="font-semibold">Archivo KML</p>
                <p className="text-muted-foreground">
                  {importMetaPreview?.sourceName || "Sin archivo asociado"}
                </p>
              </div>
              <Badge variant={geometry ? "secondary" : "outline"}>
                {geometry ? "Activo" : "Pendiente"}
              </Badge>
            </div>

            <div className="grid gap-3">
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Importado</p>
                <p className="text-muted-foreground">
                  {formatDateTime(importMetaPreview?.importedAt)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Placemark(s)</p>
                <p className="text-muted-foreground">
                  {importMetaPreview?.placemarkCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Codigo de parcela</p>
                <p className="text-muted-foreground">{parcela.codigo}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Superficie declarada</p>
                <p className="text-muted-foreground">{parcela.superficie} ha</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anotaciones</CardTitle>
            <CardDescription>
              Marque puntos del terreno y deje comentarios operativos o de referencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={beginNotePlacement} disabled={!geometry}>
                <Crosshair className="h-4 w-4" />
                Posicionar punto
              </Button>
              {(noteEditor || selectedNoteId || isPlacingNote) ? (
                <Button variant="outline" onClick={resetEditor}>
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              ) : null}
            </div>

            {isPlacingNote ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Haga click dentro del mapa para ubicar el punto de la anotacion.
              </div>
            ) : null}

            {activePreviewNote ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="map-note-title">Titulo</Label>
                  <Input
                    id="map-note-title"
                    value={activePreviewNote.titulo}
                    onChange={(event) =>
                      setNoteEditor((current) =>
                        current
                          ? { ...current, titulo: event.target.value }
                          : {
                              ...activePreviewNote,
                              titulo: event.target.value,
                            }
                      )
                    }
                    placeholder="Ej: Porton principal, zona humeda, muestra de suelo"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Longitud</Label>
                    <Input value={formatCoordinate(activePreviewNote.coordinates[0])} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Latitud</Label>
                    <Input value={formatCoordinate(activePreviewNote.coordinates[1])} readOnly />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="map-note-comment">Comentario</Label>
                  <Textarea
                    id="map-note-comment"
                    value={activePreviewNote.comentario}
                    onChange={(event) =>
                      setNoteEditor((current) =>
                        current
                          ? { ...current, comentario: event.target.value }
                          : {
                              ...activePreviewNote,
                              comentario: event.target.value,
                            }
                      )
                    }
                    placeholder="Describa una observacion del lote, acceso, riesgo, referencia o tarea pendiente."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color del punto</Label>
                  <div className="flex flex-wrap gap-2">
                    {NOTE_COLORS.map((color) => {
                      const activeColor = activePreviewNote.color === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          className={cn(
                            "h-10 w-10 rounded-full border-2 transition-transform hover:scale-105",
                            activeColor ? "border-foreground" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() =>
                            setNoteEditor((current) =>
                              current
                                ? { ...current, color }
                                : { ...activePreviewNote, color }
                            )
                          }
                          aria-label={`Seleccionar color ${color}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={handleSaveNote}>
                    <Save className="h-4 w-4" />
                    Guardar anotacion
                  </Button>
                  {activePreviewNote.mode === "edit" ? (
                    <Button variant="destructive" onClick={handleDeleteNote}>
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Seleccione una anotacion existente o use el boton Posicionar punto para crear una nueva.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista de puntos</CardTitle>
            <CardDescription>
              Cada punto queda guardado dentro de la parcela y se puede reabrir para editarlo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {localNotes.length > 0 ? (
              localNotes.map((note, index) => {
                const isActive = note.id === selectedNoteId || note.id === noteEditor?.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => openExistingNote(note)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {note.titulo || `Nota ${index + 1}`}
                        </p>
                        <p className="text-sm text-muted-foreground">{note.comentario}</p>
                      </div>
                      <span
                        className="mt-1 inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: note.color ?? DEFAULT_NOTE_COLOR }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        Lon: {formatCoordinate(note.coordinates[0])}
                      </span>
                      <span>
                        Lat: {formatCoordinate(note.coordinates[1])}
                      </span>
                      <span>Actualizado: {formatDateTime(note.updatedAt ?? note.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aun no hay observaciones marcadas dentro del mapa.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
