"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Check, ChevronsUpDown, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ControlHorario, Deposito, Empleado, Parcela, TipoTrabajo } from "@/lib/types";

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getMinutesBetween(start: string, end: string): number {
  if (!timeRegex.test(start) || !timeRegex.test(end)) return 0;
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : 0;
}

function formatHours(minutes: number): string {
  return (minutes / 60).toLocaleString("es-PY", {
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

function dateToInputValue(value?: Date | string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeTime(value?: string): string {
  const text = String(value ?? "").trim();
  return timeRegex.test(text) ? text : "";
}

function normalizeLookup(value?: string): string {
  const text = String(value ?? "").trim().toLowerCase();
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveIntervals(
  registro?: Partial<ControlHorario> | null
): { amEntrada: string; amSalida: string; pmEntrada: string; pmSalida: string } {
  const sorted = [...(registro?.actividades ?? [])].sort((a, b) =>
    a.horaInicio.localeCompare(b.horaInicio)
  );

  const first = sorted[0];
  const second = sorted[1];

  return {
    amEntrada: normalizeTime(first?.horaInicio),
    amSalida: normalizeTime(first?.horaFin),
    pmEntrada: normalizeTime(second?.horaInicio),
    pmSalida: normalizeTime(second?.horaFin),
  };
}

const formSchema = z
  .object({
    empleadoId: z.string().min(1, "Debe seleccionar un empleado."),
    fecha: z.date({ required_error: "La fecha es obligatoria." }),
    depositoId: z.string().trim().min(1, "Debe seleccionar un deposito/local."),
    parcelaId: z.string().trim().min(1, "Debe seleccionar una parcela."),
    tipoTrabajo: z.string().trim().min(3, "Debe completar el tipo de trabajo."),
    precioHoraGs: z.coerce.number().positive("Debe cargar un precio por hora en Gs mayor a 0."),
    amEntrada: z.string().trim(),
    amSalida: z.string().trim(),
    pmEntrada: z.string().trim(),
    pmSalida: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    const hasAm = value.amEntrada.length > 0 || value.amSalida.length > 0;
    const hasPm = value.pmEntrada.length > 0 || value.pmSalida.length > 0;

    if (!hasAm && !hasPm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe completar al menos un bloque horario (AM o PM).",
        path: ["amEntrada"],
      });
      return;
    }

    const validatePair = (
      start: string,
      end: string,
      startPath: "amEntrada" | "pmEntrada",
      endPath: "amSalida" | "pmSalida"
    ) => {
      if (!start && !end) return;

      if (!start || !end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe completar entrada y salida.",
          path: !start ? [startPath] : [endPath],
        });
        return;
      }

      if (!timeRegex.test(start)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato invalido (HH:mm).",
          path: [startPath],
        });
      }

      if (!timeRegex.test(end)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato invalido (HH:mm).",
          path: [endPath],
        });
      }

      if (timeRegex.test(start) && timeRegex.test(end) && getMinutesBetween(start, end) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La salida debe ser mayor a la entrada.",
          path: [endPath],
        });
      }
    };

    validatePair(value.amEntrada, value.amSalida, "amEntrada", "amSalida");
    validatePair(value.pmEntrada, value.pmSalida, "pmEntrada", "pmSalida");
  });

type ControlHorarioFormValues = z.infer<typeof formSchema>;

interface ControlHorarioFormProps {
  registro?: Partial<ControlHorario> | null;
  empleados: Empleado[];
  parcelas: Parcela[];
  depositos: Deposito[];
  tiposTrabajo: TipoTrabajo[];
  onCreateTipoTrabajo: (nombre: string) => Promise<TipoTrabajo | null>;
  onSubmit: (data: Omit<ControlHorario, "id">) => void;
  onCancel: () => void;
}

export function ControlHorarioForm({
  registro,
  empleados,
  parcelas,
  depositos,
  tiposTrabajo,
  onCreateTipoTrabajo,
  onSubmit,
  onCancel,
}: ControlHorarioFormProps) {
  const defaultIntervals = deriveIntervals(registro);
  const defaultParcelaId = registro?.actividades?.[0]?.parcelaId ?? "";
  const defaultTipoTrabajo = registro?.tipoTrabajo ?? registro?.actividades?.[0]?.descripcion ?? "";
  const depositoLookup = useMemo(() => {
    const map = new Map<string, string>();
    depositos.forEach((deposito) => {
      map.set(normalizeLookup(deposito.nombre), deposito.id);
    });
    return map;
  }, [depositos]);

  const defaultDepositoId = useMemo(() => {
    if (registro?.depositoId) return registro.depositoId;
    const fromLocal = registro?.local ? depositoLookup.get(normalizeLookup(registro.local)) : undefined;
    if (fromLocal) return fromLocal;
    return depositos[0]?.id ?? "";
  }, [depositoLookup, depositos, registro?.depositoId, registro?.local]);

  const form = useForm<ControlHorarioFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: registro
      ? {
          empleadoId: registro.empleadoId ?? "",
          fecha: registro.fecha ? new Date(registro.fecha) : new Date(),
          depositoId: defaultDepositoId,
          parcelaId: defaultParcelaId,
          tipoTrabajo: defaultTipoTrabajo,
          precioHoraGs: Math.max(0, Math.round(Number(registro.precioHoraGs ?? 0))),
          amEntrada: defaultIntervals.amEntrada,
          amSalida: defaultIntervals.amSalida,
          pmEntrada: defaultIntervals.pmEntrada,
          pmSalida: defaultIntervals.pmSalida,
        }
      : {
          empleadoId: "",
          fecha: new Date(),
          depositoId: defaultDepositoId,
          parcelaId: "",
          tipoTrabajo: "",
          precioHoraGs: 0,
          amEntrada: "07:00",
          amSalida: "11:30",
          pmEntrada: "13:30",
          pmSalida: "17:00",
      },
  });

  const [isTipoTrabajoOpen, setIsTipoTrabajoOpen] = useState(false);
  const [tipoTrabajoQuery, setTipoTrabajoQuery] = useState("");
  const [isCreatingTipoTrabajo, setIsCreatingTipoTrabajo] = useState(false);

  const tiposTrabajoActivos = useMemo(
    () =>
      [...tiposTrabajo]
        .filter((item) => item.activo !== false && (item.nombre ?? "").trim().length > 0)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [tiposTrabajo]
  );

  const tiposTrabajoFiltrados = useMemo(() => {
    const query = normalizeLookup(tipoTrabajoQuery);
    if (!query) return tiposTrabajoActivos;
    return tiposTrabajoActivos.filter((item) => normalizeLookup(item.nombre).includes(query));
  }, [tipoTrabajoQuery, tiposTrabajoActivos]);

  const puedeCrearTipoTrabajo = useMemo(() => {
    const nombre = tipoTrabajoQuery.trim();
    if (nombre.length < 3) return false;
    const normalized = normalizeLookup(nombre);
    return !tiposTrabajoActivos.some((item) => normalizeLookup(item.nombre) === normalized);
  }, [tipoTrabajoQuery, tiposTrabajoActivos]);

  const selectedDepositoId = form.watch("depositoId");
  const precioHoraGs = Number(form.watch("precioHoraGs") ?? 0);
  const amEntrada = form.watch("amEntrada");
  const amSalida = form.watch("amSalida");
  const pmEntrada = form.watch("pmEntrada");
  const pmSalida = form.watch("pmSalida");

  const selectedDeposito = useMemo(
    () => depositos.find((deposito) => deposito.id === selectedDepositoId),
    [depositos, selectedDepositoId]
  );

  useEffect(() => {
    if (form.getValues("depositoId")) return;
    if (!defaultDepositoId) return;
    form.setValue("depositoId", defaultDepositoId, { shouldValidate: true });
  }, [defaultDepositoId, form]);

  useEffect(() => {
    if (!isTipoTrabajoOpen) return;
    const current = form.getValues("tipoTrabajo") ?? "";
    setTipoTrabajoQuery(current);
  }, [form, isTipoTrabajoOpen]);

  const selectTipoTrabajo = (nombre: string) => {
    form.setValue("tipoTrabajo", nombre, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
    setTipoTrabajoQuery("");
    setIsTipoTrabajoOpen(false);
  };

  const createTipoTrabajoFromQuery = async () => {
    const nombre = tipoTrabajoQuery.trim();
    if (nombre.length < 3 || isCreatingTipoTrabajo) return;

    setIsCreatingTipoTrabajo(true);
    try {
      const created = await onCreateTipoTrabajo(nombre);
      if (created?.nombre) {
        selectTipoTrabajo(created.nombre);
      }
    } finally {
      setIsCreatingTipoTrabajo(false);
    }
  };

  const totalMinutes = useMemo(() => {
    const amMinutes = getMinutesBetween(amEntrada ?? "", amSalida ?? "");
    const pmMinutes = getMinutesBetween(pmEntrada ?? "", pmSalida ?? "");
    return amMinutes + pmMinutes;
  }, [amEntrada, amSalida, pmEntrada, pmSalida]);

  const totalAmount = useMemo(() => (totalMinutes / 60) * Math.max(0, precioHoraGs), [totalMinutes, precioHoraGs]);

  const handleSubmit = (data: ControlHorarioFormValues) => {
    const tipoTrabajo = data.tipoTrabajo.trim();
    const depositoNombre = selectedDeposito?.nombre?.trim();
    const activities: ControlHorario["actividades"] = [];

    if (data.amEntrada && data.amSalida) {
      activities.push({
        parcelaId: data.parcelaId,
        horaInicio: data.amEntrada,
        horaFin: data.amSalida,
        descripcion: tipoTrabajo,
      });
    }

    if (data.pmEntrada && data.pmSalida) {
      activities.push({
        parcelaId: data.parcelaId,
        horaInicio: data.pmEntrada,
        horaFin: data.pmSalida,
        descripcion: tipoTrabajo,
      });
    }

    onSubmit({
      empleadoId: data.empleadoId,
      fecha: data.fecha.toISOString(),
      depositoId: data.depositoId,
      local: depositoNombre || undefined,
      tipoTrabajo,
      precioHoraGs: Math.max(0, Math.round(Number(data.precioHoraGs) || 0)),
      actividades: activities.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="depositoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LOCAL (Depósito)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un deposito" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {depositos.map((deposito) => (
                      <SelectItem key={deposito.id} value={deposito.id}>
                        {deposito.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="empleadoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NOMBRE Y APELLIDO</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un empleado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {empleados.map((empleado) => (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {empleado.nombre} {empleado.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fecha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    lang="es-PY"
                    value={dateToInputValue(field.value)}
                    onChange={(event) => field.onChange(inputValueToDate(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="parcelaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PARCELA</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una parcela" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {parcelas.map((parcela) => (
                      <SelectItem key={parcela.id} value={parcela.id}>
                        {parcela.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="precioHoraGs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PRECIO POR HORAS (Gs)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder="Ej: 14500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tipoTrabajo"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>TIPO DE TRABAJO</FormLabel>
                <Popover open={isTipoTrabajoOpen} onOpenChange={setIsTipoTrabajoOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {field.value || "Seleccione o busque un tipo de trabajo"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Escriba parte del nombre..."
                        value={tipoTrabajoQuery}
                        onValueChange={setTipoTrabajoQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No se encontraron tipos de trabajo.</CommandEmpty>
                        <CommandGroup heading="Tipos disponibles">
                          {tiposTrabajoFiltrados.map((tipo) => (
                            <CommandItem
                              key={tipo.id}
                              value={`${tipo.nombre} ${tipo.id}`}
                              onSelect={() => selectTipoTrabajo(tipo.nombre)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  normalizeLookup(tipo.nombre) === normalizeLookup(field.value)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {tipo.nombre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {puedeCrearTipoTrabajo && (
                          <CommandGroup heading="Crear nuevo">
                            <CommandItem
                              value={`crear ${tipoTrabajoQuery}`}
                              onSelect={() => {
                                void createTipoTrabajoFromQuery();
                              }}
                              disabled={isCreatingTipoTrabajo}
                            >
                              {isCreatingTipoTrabajo ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <PlusCircle className="mr-2 h-4 w-4" />
                              )}
                              Crear &quot;{tipoTrabajoQuery.trim()}&quot;
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input type="hidden" {...field} />
                <p className="text-xs text-muted-foreground">
                  Busque por nombre y, si no existe, cree uno nuevo desde aqui.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="amEntrada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>AM Ent.</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amSalida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>AM Sal.</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pmEntrada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PM Ent.</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pmSalida"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PM Sal.</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Horas de Trabajo</p>
            <p className="text-lg font-semibold">{formatHours(totalMinutes)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">PRECIO POR HORAS</p>
            <p className="text-lg font-semibold">{formatMoney(Math.max(0, precioHoraGs))}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total por Horas</p>
            <p className="text-lg font-semibold">{formatMoney(totalAmount)}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{registro?.id ? "Guardar Cambios" : "Crear Registro"}</Button>
        </div>
      </form>
    </Form>
  );
}
