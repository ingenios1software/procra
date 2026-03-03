"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Briefcase, Clock3, DollarSign, MapPinned, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ControlHorario, Deposito, Empleado, Parcela } from "@/lib/types";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const FILTER_ALL = "__ALL__";
const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

type DashboardRow = {
  local: string;
  empleado: string;
  parcela: string;
  tipoTrabajo: string;
  horas: number;
  precioHora: number;
  totalPagar: number;
};

type AggregateRow = {
  nombre: string;
  registros: number;
  horas: number;
  totalPagar: number;
};

interface ControlHorarioDashboardProps {
  registros: ControlHorario[];
  empleados: Empleado[];
  parcelas: Parcela[];
  depositos: Deposito[];
  rangeStart: Date;
  rangeEnd: Date;
  isLoading: boolean;
  invalidDateRange: boolean;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getMinutesBetween(start: string, end: string): number {
  if (!timeRegex.test(start) || !timeRegex.test(end)) return 0;
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : 0;
}

function getRegistroMinutes(registro: ControlHorario): number {
  return registro.actividades.reduce(
    (sum, actividad) => sum + getMinutesBetween(actividad.horaInicio, actividad.horaFin),
    0
  );
}

function getRegistroPrecioHora(registro: ControlHorario): number {
  const value = Number(registro.precioHoraGs ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function formatHours(hours: number): string {
  return hours.toLocaleString("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(amount: number): string {
  return `Gs. ${amount.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactMoney(amount: number): string {
  const absolute = Math.abs(amount);
  if (absolute >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return `${Math.round(amount)}`;
}

function truncateLabel(value: string, max = 22): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function sortLabels(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

export function ControlHorarioDashboard({
  registros,
  empleados,
  parcelas,
  depositos,
  rangeStart,
  rangeEnd,
  isLoading,
  invalidDateRange,
}: ControlHorarioDashboardProps) {
  const baseRows = useMemo<DashboardRow[]>(() => {
    const empleadoById = new Map(
      empleados.map((empleado) => [empleado.id, `${empleado.nombre} ${empleado.apellido}`.trim()])
    );
    const parcelaById = new Map(parcelas.map((parcela) => [parcela.id, parcela.nombre]));
    const depositoById = new Map(depositos.map((deposito) => [deposito.id, deposito.nombre]));

    return registros.map((registro) => {
      const sortedActividades = [...registro.actividades].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      const firstActividad = sortedActividades[0];
      const parcelaNombre = firstActividad?.parcelaId ? parcelaById.get(firstActividad.parcelaId) || "N/A" : "N/A";
      const local =
        (registro.depositoId ? depositoById.get(registro.depositoId) : undefined) ||
        registro.local?.trim() ||
        parcelaNombre ||
        "Sin local";
      const empleado = empleadoById.get(registro.empleadoId) || "N/A";
      const tipoTrabajo = registro.tipoTrabajo?.trim() || firstActividad?.descripcion?.trim() || "Sin tipo";
      const horas = getRegistroMinutes(registro) / 60;
      const precioHora = getRegistroPrecioHora(registro);
      const totalPagar = horas * precioHora;

      return {
        local,
        empleado,
        parcela: parcelaNombre,
        tipoTrabajo,
        horas,
        precioHora,
        totalPagar,
      };
    });
  }, [depositos, empleados, parcelas, registros]);

  const localOptions = useMemo(
    () => sortLabels(Array.from(new Set(baseRows.map((row) => row.local)))),
    [baseRows]
  );
  const empleadoOptions = useMemo(
    () => sortLabels(Array.from(new Set(baseRows.map((row) => row.empleado)))),
    [baseRows]
  );
  const tipoTrabajoOptions = useMemo(
    () => sortLabels(Array.from(new Set(baseRows.map((row) => row.tipoTrabajo)))),
    [baseRows]
  );

  const [selectedLocal, setSelectedLocal] = useState<string>(FILTER_ALL);
  const [selectedEmpleado, setSelectedEmpleado] = useState<string>(FILTER_ALL);
  const [selectedTipoTrabajo, setSelectedTipoTrabajo] = useState<string>(FILTER_ALL);

  useEffect(() => {
    if (selectedLocal !== FILTER_ALL && !localOptions.includes(selectedLocal)) {
      setSelectedLocal(FILTER_ALL);
    }
  }, [localOptions, selectedLocal]);

  useEffect(() => {
    if (selectedEmpleado !== FILTER_ALL && !empleadoOptions.includes(selectedEmpleado)) {
      setSelectedEmpleado(FILTER_ALL);
    }
  }, [empleadoOptions, selectedEmpleado]);

  useEffect(() => {
    if (selectedTipoTrabajo !== FILTER_ALL && !tipoTrabajoOptions.includes(selectedTipoTrabajo)) {
      setSelectedTipoTrabajo(FILTER_ALL);
    }
  }, [selectedTipoTrabajo, tipoTrabajoOptions]);

  const filteredRows = useMemo(() => {
    return baseRows.filter((row) => {
      if (selectedLocal !== FILTER_ALL && row.local !== selectedLocal) return false;
      if (selectedEmpleado !== FILTER_ALL && row.empleado !== selectedEmpleado) return false;
      if (selectedTipoTrabajo !== FILTER_ALL && row.tipoTrabajo !== selectedTipoTrabajo) return false;
      return true;
    });
  }, [baseRows, selectedEmpleado, selectedLocal, selectedTipoTrabajo]);

  const dashboard = useMemo(() => {
    const aggregate = (rows: DashboardRow[], keySelector: (row: DashboardRow) => string): AggregateRow[] => {
      const map = new Map<string, AggregateRow>();
      rows.forEach((row) => {
        const key = keySelector(row) || "N/A";
        const current = map.get(key) ?? { nombre: key, registros: 0, horas: 0, totalPagar: 0 };
        current.registros += 1;
        current.horas += row.horas;
        current.totalPagar += row.totalPagar;
        map.set(key, current);
      });
      return [...map.values()].sort((a, b) => b.totalPagar - a.totalPagar);
    };

    const porLocal = aggregate(filteredRows, (row) => row.local);
    const porEmpleado = aggregate(filteredRows, (row) => row.empleado);
    const porParcela = aggregate(filteredRows, (row) => row.parcela);
    const porTipoTrabajo = aggregate(filteredRows, (row) => row.tipoTrabajo);

    const totalHoras = filteredRows.reduce((acc, row) => acc + row.horas, 0);
    const totalPagar = filteredRows.reduce((acc, row) => acc + row.totalPagar, 0);
    const precioMasAlto = filteredRows.reduce<DashboardRow | null>(
      (acc, row) => (row.precioHora > (acc?.precioHora ?? 0) ? row : acc),
      null
    );
    const trabajoMasCostoso = porTipoTrabajo[0];

    const gastoPorLocalChart = porLocal.slice(0, 8).map((item) => ({
      name: truncateLabel(item.nombre, 18),
      totalPagar: Math.round(item.totalPagar),
    }));
    const horasPorEmpleadoChart = [...porEmpleado]
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 8)
      .map((item) => ({
        name: truncateLabel(item.nombre, 20),
        horas: Number(item.horas.toFixed(2)),
      }));
    const gastoPorParcelaChart = porParcela.slice(0, 8).map((item) => ({
      name: truncateLabel(item.nombre, 16),
      totalPagar: Math.round(item.totalPagar),
    }));

    const topTipos = porTipoTrabajo.slice(0, 5);
    const restanteTipos = porTipoTrabajo
      .slice(5)
      .reduce((acc, item) => acc + item.totalPagar, 0);
    const gastoPorTrabajoChart = [
      ...topTipos.map((item) => ({ name: item.nombre, value: Math.round(item.totalPagar) })),
      ...(restanteTipos > 0 ? [{ name: "Otros", value: Math.round(restanteTipos) }] : []),
    ];

    return {
      rows: filteredRows,
      porLocal,
      porEmpleado,
      porParcela,
      totalHoras,
      totalPagar,
      precioMasAlto,
      trabajoMasCostoso,
      gastoPorLocalChart,
      horasPorEmpleadoChart,
      gastoPorParcelaChart,
      gastoPorTrabajoChart,
    };
  }, [filteredRows]);

  const filtrosActivos = [selectedLocal, selectedEmpleado, selectedTipoTrabajo].filter(
    (value) => value !== FILTER_ALL
  ).length;

  const clearFilters = () => {
    setSelectedLocal(FILTER_ALL);
    setSelectedEmpleado(FILTER_ALL);
    setSelectedTipoTrabajo(FILTER_ALL);
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dashboard de Control Horario</CardTitle>
          <CardDescription>Cargando metricas y graficos...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invalidDateRange) {
    return (
      <Card className="mb-6 border-destructive/40">
        <CardHeader>
          <CardTitle>Dashboard de Control Horario</CardTitle>
          <CardDescription>Corrija el rango de fechas para ver metricas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (baseRows.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Dashboard de Control Horario</CardTitle>
          <CardDescription>
            Sin registros entre {format(rangeStart, "dd/MM/yyyy")} y {format(rangeEnd, "dd/MM/yyyy")}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-6">
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle>Filtros del Dashboard</CardTitle>
          <CardDescription>Filtran solo metricas y graficos de esta seccion.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Local</p>
            <Select value={selectedLocal} onValueChange={setSelectedLocal}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los locales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>Todos los locales</SelectItem>
                {localOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empleado</p>
            <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los empleados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>Todos los empleados</SelectItem>
                {empleadoOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de trabajo
            </p>
            <Select value={selectedTipoTrabajo} onValueChange={setSelectedTipoTrabajo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>Todos los tipos</SelectItem>
                {tipoTrabajoOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full lg:w-auto" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground lg:col-span-4">
            <Badge variant="secondary">Registros en dashboard: {dashboard.rows.length}</Badge>
            <Badge variant="outline">Registros del periodo: {baseRows.length}</Badge>
            <Badge variant="outline">Filtros activos: {filtrosActivos}</Badge>
          </div>
        </CardContent>
      </Card>

      {dashboard.rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin resultados con los filtros actuales</CardTitle>
            <CardDescription>
              Ajuste los filtros para volver a ver metricas entre {format(rangeStart, "dd/MM/yyyy")} y{" "}
              {format(rangeEnd, "dd/MM/yyyy")}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card">
            <CardHeader>
              <CardTitle>Dashboard de Control Horario</CardTitle>
              <CardDescription>
                Metricas del periodo {format(rangeStart, "dd/MM/yyyy")} al {format(rangeEnd, "dd/MM/yyyy")}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Horas Totales
                </div>
                <p className="text-2xl font-bold">{formatHours(dashboard.totalHoras)} h</p>
                <p className="text-xs text-muted-foreground">{dashboard.rows.length} registros</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Gasto Total
                </div>
                <p className="text-2xl font-bold">{formatMoney(dashboard.totalPagar)}</p>
                <p className="text-xs text-muted-foreground">Total pagado por horas</p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Precio Hora Mas Alto
                </div>
                <p className="text-2xl font-bold">{formatMoney(dashboard.precioMasAlto?.precioHora ?? 0)}</p>
                <p className="text-xs text-muted-foreground">
                  {dashboard.precioMasAlto?.empleado || "N/A"} - {dashboard.precioMasAlto?.local || "N/A"}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  Trabajo con Mas Gasto
                </div>
                <p className="text-lg font-bold">{dashboard.trabajoMasCostoso?.nombre || "N/A"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(dashboard.trabajoMasCostoso?.totalPagar || 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Gasto por Local</CardTitle>
                <CardDescription>Top locales por costo acumulado.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.gastoPorLocalChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(value) => formatCompactMoney(Number(value))} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value))}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Bar dataKey="totalPagar" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horas por Empleado</CardTitle>
                <CardDescription>Top empleados por horas registradas.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.horasPorEmpleadoChart} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) =>
                        `${Number(value).toLocaleString("es-PY", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} h`
                      }
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Bar dataKey="horas" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gasto por Parcela</CardTitle>
                <CardDescription>Parcelas donde mas se invirtio en horas.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.gastoPorParcelaChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(value) => formatCompactMoney(Number(value))} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value))}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                    <Bar dataKey="totalPagar" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gasto por Tipo de Trabajo</CardTitle>
                <CardDescription>Distribucion de costo por actividad.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dashboard.gastoPorTrabajoChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      labelLine={false}
                      label={({ name, percent }) =>
                        (percent || 0) >= 0.08 ? `${name} ${((percent || 0) * 100).toFixed(0)}%` : ""
                      }
                    >
                      {dashboard.gastoPorTrabajoChart.map((item, index) => (
                        <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatMoney(Number(value))}
                      contentStyle={{ backgroundColor: "hsl(var(--background))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-muted-foreground" />
                  Mediciones por Local
                </CardTitle>
                <CardDescription>Horas, registros y gasto acumulado por local.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Local</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.porLocal.slice(0, 8).map((item) => (
                      <TableRow key={item.nombre}>
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        <TableCell className="text-right">{item.registros}</TableCell>
                        <TableCell className="text-right">{formatHours(item.horas)}</TableCell>
                        <TableCell className="text-right">{formatMoney(item.totalPagar)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Mediciones por Empleado
                </CardTitle>
                <CardDescription>Horas y gasto acumulado por empleado.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Tarifa Prom.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.porEmpleado.slice(0, 8).map((item) => {
                      const tarifaPromedio = item.horas > 0 ? item.totalPagar / item.horas : 0;
                      return (
                        <TableRow key={item.nombre}>
                          <TableCell className="font-medium">{item.nombre}</TableCell>
                          <TableCell className="text-right">{formatHours(item.horas)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.totalPagar)}</TableCell>
                          <TableCell className="text-right">{formatMoney(tarifaPromedio)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">
                    Empleados activos en periodo: {dashboard.porEmpleado.filter((item) => item.horas > 0).length}
                  </Badge>
                  <Badge variant="secondary">Locales con carga: {dashboard.porLocal.length}</Badge>
                  <Badge variant="secondary">Parcelas con carga: {dashboard.porParcela.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

