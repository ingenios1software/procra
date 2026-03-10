"use client";

import { Fragment, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCollection, useMemoFirebase } from "@/firebase";
import { orderBy } from "firebase/firestore";
import type { AsientoDiario, CentroDeCosto, PlanDeCuenta, Zafra } from "@/lib/types";
import {
  getAsientoZafraLabel,
  matchesAsientoZafraFilter,
  ZAFRA_FILTER_ALL,
  ZAFRA_FILTER_NONE,
} from "@/lib/contabilidad/asientos";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esAsientoServicioCosecha(asiento: AsientoDiario): boolean {
  const descripcion = normalizeText(asiento.descripcion);
  if (descripcion.includes("costo servicio cosecha")) return true;
  return descripcion.includes("servicio") && descripcion.includes("cosecha");
}

export default function DiarioPage() {
  const tenant = useTenantFirestore();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "servicio_cosecha">("servicio_cosecha");
  const [selectedZafraId, setSelectedZafraId] = useState<string>(ZAFRA_FILTER_ALL);

  const asientosQuery = useMemoFirebase(
    () => tenant.query("asientosDiario", orderBy("fecha", "desc")),
    [tenant]
  );
  const { data: asientosDiario, isLoading: isLoadingAsientos } = useCollection<AsientoDiario>(asientosQuery);

  const planDeCuentasQuery = useMemoFirebase(
    () => tenant.collection("planDeCuentas"),
    [tenant]
  );
  const { data: planDeCuentas, isLoading: isLoadingCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const centrosDeCostoQuery = useMemoFirebase(
    () => tenant.collection("centrosDeCosto"),
    [tenant]
  );
  const { data: centrosDeCosto, isLoading: isLoadingCentros } = useCollection<CentroDeCosto>(centrosDeCostoQuery);

  const zafrasQuery = useMemoFirebase(
    () => tenant.query("zafras", orderBy("nombre")),
    [tenant]
  );
  const { data: zafras } = useCollection<Zafra>(zafrasQuery);

  const cuentasById = useMemo(
    () => new Map((planDeCuentas || []).map((cuenta) => [cuenta.id, cuenta])),
    [planDeCuentas]
  );
  const centrosById = useMemo(
    () => new Map((centrosDeCosto || []).map((centro) => [centro.id, centro])),
    [centrosDeCosto]
  );

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  };

  const asientosFiltrados = useMemo(() => {
    const needle = normalizeText(busqueda);
    return (asientosDiario || []).filter((asiento) => {
      if (!matchesAsientoZafraFilter(asiento, selectedZafraId)) return false;

      const cumpleTipo = filtroTipo === "todos" ? true : esAsientoServicioCosecha(asiento);
      if (!cumpleTipo) return false;
      if (!needle) return true;

      const descripcion = normalizeText(asiento.descripcion);
      if (descripcion.includes(needle)) return true;

      const cuentasDelAsiento = asiento.movimientos
        .map((mov) => {
          const cuenta = cuentasById.get(mov.cuentaId);
          return `${cuenta?.codigo || ""} ${cuenta?.nombre || ""}`;
        })
        .join(" ");

      return normalizeText(cuentasDelAsiento).includes(needle);
    });
  }, [asientosDiario, busqueda, cuentasById, filtroTipo, selectedZafraId]);

  const totalAsientos = (asientosDiario || []).length;
  const totalServicioCosecha = useMemo(
    () => (asientosDiario || []).filter(esAsientoServicioCosecha).length,
    [asientosDiario]
  );
  const isLoading = isLoadingAsientos || isLoadingCuentas || isLoadingCentros;

  return (
    <>
      <PageHeader
        title="Libro Diario"
        description="Consulte los asientos contables registrados en el sistema."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Asientos Contables</CardTitle>
              <Badge variant="secondary">Total: {totalAsientos}</Badge>
              <Badge variant="outline">Servicio de Cosecha: {totalServicioCosecha}</Badge>
              <Badge className="bg-primary/80 text-primary-foreground">Mostrando: {asientosFiltrados.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="Buscar por descripcion o cuenta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="md:max-w-md"
              />
              <Select value={selectedZafraId} onValueChange={setSelectedZafraId}>
                <SelectTrigger className="md:w-[240px]">
                  <SelectValue placeholder="Filtrar por zafra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ZAFRA_FILTER_ALL}>Todas las zafras</SelectItem>
                  <SelectItem value={ZAFRA_FILTER_NONE}>Sin zafra</SelectItem>
                  {(zafras || []).map((zafra) => (
                    <SelectItem key={zafra.id} value={zafra.id}>
                      {zafra.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={(value) => setFiltroTipo(value as "todos" | "servicio_cosecha")}>
                <SelectTrigger className="md:w-[260px]">
                  <SelectValue placeholder="Filtrar tipo de asiento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los asientos</SelectItem>
                  <SelectItem value="servicio_cosecha">Solo servicio de cosecha</SelectItem>
                </SelectContent>
              </Select>
              {(busqueda || filtroTipo !== "servicio_cosecha" || selectedZafraId !== ZAFRA_FILTER_ALL) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBusqueda("");
                    setFiltroTipo("servicio_cosecha");
                    setSelectedZafraId(ZAFRA_FILTER_ALL);
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Zafra</TableHead>
                <TableHead>Descripcion del Asiento</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">Cargando...</TableCell>
                </TableRow>
              )}
              {asientosFiltrados.map((asiento) => {
                const isExpanded = expandedRows.has(asiento.id);
                const total = asiento.movimientos
                  .filter((mov) => mov.tipo === "debe")
                  .reduce((sum, mov) => sum + mov.monto, 0);

                return (
                  <Fragment key={asiento.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(asiento.id)}
                    >
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>{format(new Date(asiento.fecha as string), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getAsientoZafraLabel(asiento)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{asiento.descripcion}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${total.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/40">
                        <TableCell colSpan={5} className="p-0">
                          <div className="p-4">
                            <h4 className="mb-2 ml-2 font-semibold">Detalle del Asiento:</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Cuenta Contable</TableHead>
                                  <TableHead>Centro de Costo</TableHead>
                                  <TableHead className="text-right">Debe</TableHead>
                                  <TableHead className="text-right">Haber</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {asiento.movimientos.map((mov, index) => (
                                  <TableRow key={index} className="border-b-0">
                                    <TableCell>{cuentasById.get(mov.cuentaId)?.nombre || "N/A"}</TableCell>
                                    <TableCell>
                                      {mov.centroCostoId ? (
                                        <Badge variant="secondary">{centrosById.get(mov.centroCostoId)?.nombre || "N/A"}</Badge>
                                      ) : (
                                        "N/A"
                                      )}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-mono",
                                        mov.tipo === "debe" && "text-green-600"
                                      )}
                                    >
                                      {mov.tipo === "debe"
                                        ? `$${mov.monto.toLocaleString("de-DE", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}`
                                        : "-"}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-mono",
                                        mov.tipo === "haber" && "text-red-600"
                                      )}
                                    >
                                      {mov.tipo === "haber"
                                        ? `$${mov.monto.toLocaleString("de-DE", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}`
                                        : "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {!isLoading && asientosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay asientos que coincidan con el filtro aplicado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
