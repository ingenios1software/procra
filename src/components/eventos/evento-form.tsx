"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Evento, Insumo, Parcela, Cultivo, Zafra, EtapaCultivo, EventoBorrador, Foto, Usuario, PlanDeCuenta, Maquinaria } from "@/lib/types";
import { Cloud, Thermometer, Wind, Eraser, Check, Ban } from "lucide-react";
import { format } from "date-fns";
import { EventoAnalisisPanel } from "./evento-analisis-panel";
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, updateDocumentNonBlocking } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { useDraftStore } from "@/store/draft-store";
import isEqual from 'lodash.isequal';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import { ImageUpload } from "./ImageUpload";
import { InsumosTabla } from "./InsumosTabla";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { SelectorUniversal } from "../common";
import { SelectorPlanDeCuentas } from "../contabilidad/SelectorPlanDeCuentas";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";


const productoSchema = z.object({
  insumo: z.any().refine(val => val && val.id, { message: "Debe seleccionar un insumo válido." }),
  dosis: z.coerce.number().positive("La dosis debe ser mayor a 0."),
});

const fotoSchema = z.object({
  url: z.string(),
  storagePath: z.string(),
});

const formSchema = z.object({
  parcelaId: z.string().nonempty("Debe seleccionar una parcela."),
  cultivoId: z.string().nonempty("Debe seleccionar un cultivo."),
  zafraId: z.string().nonempty("Debe seleccionar una zafra."),
  tipo: z.enum(['siembra', 'fertilización', 'riego', 'cosecha', 'mantenimiento', 'plagas', 'aplicacion', 'rendimiento']),
  fecha: z.date({ required_error: "La fecha es obligatoria." }),
  descripcion: z.string().min(5, "La descripción es muy corta."),
  
  hectareasAplicadas: z.coerce.number().optional(),
  costoServicioPorHa: z.coerce.number().optional(),

  productos: z.array(productoSchema).optional(),
  fotos: z.array(fotoSchema).optional(),

  temperatura: z.coerce.number().optional(),
  humedad: z.coerce.number().optional(),
  viento: z.coerce.number().optional(),

  resultado: z.string().optional(),
  
  toneladas: z.coerce.number().optional(),
  precioTonelada: z.coerce.number().optional(),

  maquinariaId: z.string().optional(),
  horometroAnterior: z.coerce.number().optional(),
  horometroActual: z.coerce.number().optional(),
  
  // Workflow
  estado: z.enum(['pendiente', 'aprobado', 'rechazado']).optional(),
  motivoRechazo: z.string().optional(),

  cuentaContableId: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  const esCosecha = data.tipo === "cosecha" || data.tipo === "rendimiento";
  const toneladas = Number(data.toneladas) || 0;
  const hectareasCosechadas = Number(data.hectareasAplicadas) || 0;
  const costoServicioPorHa = Number(data.costoServicioPorHa) || 0;
  const precioTonelada = Number(data.precioTonelada) || 0;

  if (esCosecha && hectareasCosechadas <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hectareasAplicadas"],
      message: "Ingrese las hectareas cosechadas.",
    });
  }

  if (esCosecha && costoServicioPorHa <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["costoServicioPorHa"],
      message: "Ingrese el costo de servicio por hectarea.",
    });
  }

  if (esCosecha && toneladas <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toneladas"],
      message: "Ingrese las toneladas cosechadas.",
    });
  }

  if (esCosecha && precioTonelada <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["precioTonelada"],
      message: "Ingrese el precio referencial por tonelada para valorizar la cosecha.",
    });
  }

  const usaCombustible = tieneProductoCombustible(data.productos as Array<{ insumo?: Partial<Insumo> | null }> | undefined);
  const horometroAnterior = Number(data.horometroAnterior ?? 0);
  const horometroActual = Number(data.horometroActual ?? 0);

  if (usaCombustible && !data.maquinariaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maquinariaId"],
      message: "Seleccione la maquinaria que consumio el combustible.",
    });
  }

  if (usaCombustible && horometroAnterior < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horometroAnterior"],
      message: "La hora anterior no puede ser negativa.",
    });
  }

  if (usaCombustible && horometroActual <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horometroActual"],
      message: "Ingrese la hora actual del horometro.",
    });
  }

  if (usaCombustible && horometroActual < horometroAnterior) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horometroActual"],
      message: "La hora actual no puede ser menor a la hora anterior.",
    });
  }
});

type EventoFormValues = z.infer<typeof formSchema>;

interface EventoFormProps {
  evento?: Evento | null;
  onSave: (data: Omit<Evento, 'id'>) => Promise<void>;
  onCancel: () => void;
}

function dateToInputValue(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "";
  return format(value, "yyyy-MM-dd");
}

function inputValueToDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizarTipoEvento(tipo?: Evento["tipo"] | string): Evento["tipo"] {
  if (!tipo) return "aplicacion";
  return tipo === "rendimiento" ? "cosecha" : (tipo as Evento["tipo"]);
}

function normalizarTexto(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function esInsumoCombustible(insumo?: Partial<Insumo> | null): boolean {
  if (!insumo) return false;
  return normalizarTexto(insumo.categoria) === "combustible";
}

function tieneProductoCombustible(productos?: Array<{ insumo?: Partial<Insumo> | null }> | null): boolean {
  return (productos || []).some((producto) => esInsumoCombustible(producto?.insumo));
}

function calcularHectareasPlantadasContexto({
  eventos,
  parcelaId,
  cultivoId,
  zafraId,
  superficieFallback,
}: {
  eventos: Evento[];
  parcelaId?: string;
  cultivoId?: string;
  zafraId?: string;
  superficieFallback?: number;
}): number {
  const fallback = Number(superficieFallback) || 0;
  if (!parcelaId || !cultivoId || !zafraId) return fallback;

  const hectareasSiembra = eventos.reduce((maximo, ev) => {
    if (ev.parcelaId !== parcelaId || ev.cultivoId !== cultivoId || ev.zafraId !== zafraId) {
      return maximo;
    }
    if (normalizarTipoEvento(ev.tipo) !== "siembra") return maximo;
    const hectareasEvento = Number(ev.hectareasAplicadas) || 0;
    return hectareasEvento > maximo ? hectareasEvento : maximo;
  }, 0);

  return hectareasSiembra > 0 ? hectareasSiembra : fallback;
}

export function EventoForm({ evento, onSave, onCancel }: EventoFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const tenant = useTenantFirestore();
  const { user } = useUser();
  const { role, permisos, user: usuarioApp } = useAuth();
  const { draft, setDraft, clearDraft } = useDraftStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const draftRef = useRef(draft);

  const { data: parcelas } = useCollection<Parcela>(useMemoFirebase(() => tenant.collection('parcelas'), [tenant]));
  const { data: cultivos } = useCollection<Cultivo>(useMemoFirebase(() => tenant.collection('cultivos'), [tenant]));
  const { data: zafras } = useCollection<Zafra>(useMemoFirebase(() => tenant.collection('zafras'), [tenant]));
  const { data: insumos } = useCollection<Insumo>(useMemoFirebase(() => tenant.collection('insumos'), [tenant]));
  const { data: maquinarias } = useCollection<Maquinaria>(
    useMemoFirebase(() => tenant.query("maquinaria", orderBy("nombre")), [tenant])
  );
  const { data: todosLosEventos } = useCollection<Evento>(useMemoFirebase(() => tenant.collection('eventos'), [tenant]));
  const { data: etapasCultivo } = useCollection<EtapaCultivo>(useMemoFirebase(() => tenant.collection('etapasCultivo'), [tenant]));
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(() => tenant.query("planDeCuentas", orderBy("codigo")), [tenant])
  );
  const nombrePersistidoAprobador = (evento as any)?.aprobadoPorNombre;
  const hasNombrePersistidoValido =
    !!nombrePersistidoAprobador && nombrePersistidoAprobador !== evento?.aprobadoPor;

  const shouldLookupAprobador =
    role === 'admin' &&
    !!evento?.aprobadoPor &&
    !hasNombrePersistidoValido &&
    evento.aprobadoPor !== user?.uid;

  const aprobadorRef = useMemoFirebase(
    () => (shouldLookupAprobador && firestore && evento?.aprobadoPor)
      ? doc(firestore, 'usuarios', evento.aprobadoPor)
      : null,
    [shouldLookupAprobador, firestore, evento?.aprobadoPor]
  );
  const { data: aprobador } = useDoc<Usuario>(aprobadorRef);

  const aprobadoPorNombre = useMemo(() => {
    if (hasNombrePersistidoValido) {
      return nombrePersistidoAprobador;
    }
    if (evento?.aprobadoPor && user?.uid && evento.aprobadoPor === user.uid) {
      return usuarioApp?.nombre || user.email || 'Aprobador';
    }
    if (aprobador?.nombre) return aprobador.nombre;
    if (evento?.aprobadoPor) return 'Aprobador';
    return 'N/A';
  }, [evento, aprobador, user, usuarioApp, hasNombrePersistidoValido, nombrePersistidoAprobador]);
  
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const getInitialValues = useCallback(() => {
    // Si estamos editando un evento existente, usamos sus datos.
    if (evento) {
      return {
        ...evento,
        fecha: new Date(evento.fecha as string),
        hectareasAplicadas: evento.hectareasAplicadas ?? '',
        costoServicioPorHa: evento.costoServicioPorHa ?? '',
        temperatura: evento.temperatura ?? '',
        humedad: evento.humedad ?? '',
        viento: evento.viento ?? '',
        toneladas: evento.toneladas ?? '',
        precioTonelada: evento.precioTonelada ?? '',
        maquinariaId: evento.maquinariaId,
        horometroAnterior: evento.horometroAnterior ?? '',
        horometroActual: evento.horometroActual ?? '',
        resultado: evento.resultado ?? '',
        cuentaContableId: evento.cuentaContableId || null,
      };
    }
    // Si no hay evento y existe un borrador, usamos el borrador.
    const currentDraft = draftRef.current;
    if (currentDraft && Object.keys(currentDraft).length > 0) {
      return { 
        ...currentDraft, 
        fecha: currentDraft.fecha ? new Date(currentDraft.fecha) : new Date() 
      };
    }
    // Si no hay nada, valores por defecto para un evento nuevo.
    return {
      fecha: new Date(),
      tipo: 'aplicacion',
      productos: [],
      fotos: [],
      descripcion: "",
      hectareasAplicadas: '' as any,
      costoServicioPorHa: '' as any,
      temperatura: '' as any,
      humedad: '' as any,
      viento: '' as any,
      toneladas: '' as any,
      precioTonelada: '' as any,
      maquinariaId: undefined,
      horometroAnterior: '' as any,
      horometroActual: '' as any,
      resultado: '',
      cuentaContableId: null,
    };
  }, [evento]);

  const form = useForm<EventoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues() as any,
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "productos",
  });
  
  const roleNormalizado = (role || '').toLowerCase().trim();
  const estadoActual = evento?.estado || 'pendiente';
  const puedeAprobar =
    permisos?.administracion ||
    roleNormalizado === 'admin' ||
    roleNormalizado === 'supervisor';
  const isFinalizado = estadoActual === 'aprobado' || estadoActual === 'rechazado';


  useEffect(() => {
    // Cuando el `evento` que viene de las props cambia, reseteamos el formulario
    // con los valores correctos, sea un evento existente o un formulario nuevo/borrador.
    form.reset(getInitialValues() as any);
  }, [form, getInitialValues]);


  useEffect(() => {
    // Esta lógica de guardado de borrador solo se aplica si NO estamos editando un evento existente.
    if (evento) return;

    const intervalId = setInterval(() => {
        const currentValues = form.getValues();
        setDraft(currentValues as EventoBorrador);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [evento, form, setDraft]);


  const tipoEvento = form.watch('tipo');
  const tipoEventoNormalizado = normalizarTipoEvento(tipoEvento);
  const esEventoCosecha = tipoEventoNormalizado === "cosecha";
  const watchedHectareas = form.watch('hectareasAplicadas');
  const watchedToneladas = form.watch('toneladas');
  const watchedProductos = useWatch({
    control: form.control,
    name: 'productos',
  });
  const watchedCostoServicio = form.watch('costoServicioPorHa');
  const watchedParcelaId = form.watch('parcelaId');
  const watchedCultivoId = form.watch('cultivoId');
  const watchedZafraId = form.watch('zafraId');
  const watchedFecha = form.watch('fecha');
  const watchedMaquinariaId = form.watch('maquinariaId');
  const watchedHorometroAnterior = form.watch('horometroAnterior');
  const watchedHorometroActual = form.watch('horometroActual');
  const insumosPorId = useMemo(() => {
    return new Map((insumos || []).map((insumo) => [insumo.id, insumo]));
  }, [insumos]);
  const maquinariasPorId = useMemo(() => {
    return new Map((maquinarias || []).map((maquinaria) => [maquinaria.id, maquinaria]));
  }, [maquinarias]);
  const usaCombustibleEnFormulario = useMemo(
    () => tieneProductoCombustible(watchedProductos as Array<{ insumo?: Partial<Insumo> | null }> | undefined),
    [watchedProductos]
  );
  const maquinariaSeleccionada = useMemo(
    () => (watchedMaquinariaId ? maquinariasPorId.get(watchedMaquinariaId) : undefined),
    [maquinariasPorId, watchedMaquinariaId]
  );

  useEffect(() => {
    if (!evento) return;
    const productosActuales = form.getValues('productos') || [];
    if (!Array.isArray(productosActuales) || productosActuales.length === 0) return;

    let huboCambios = false;
    const productosHidratados = productosActuales.map((producto: any) => {
      if (!producto) return producto;
      const insumoId = producto.insumo?.id || producto.insumoId;
      if (!insumoId) return producto;

      const insumoEncontrado = insumosPorId.get(insumoId);
      if (insumoEncontrado) {
        const yaHidratado =
          producto.insumo?.id === insumoEncontrado.id &&
          producto.insumo?.nombre === insumoEncontrado.nombre &&
          producto.insumo?.costoUnitario === insumoEncontrado.costoUnitario &&
          producto.insumo?.precioPromedioCalculado === insumoEncontrado.precioPromedioCalculado;
        if (yaHidratado) return producto;
        huboCambios = true;
        return {
          ...producto,
          insumo: insumoEncontrado,
          codigo: producto.codigo || (insumoEncontrado.numeroItem?.toString() || ''),
        };
      }

      if (producto.insumo?.id) return producto;
      huboCambios = true;

      return {
        ...producto,
        insumo: { id: insumoId } as Insumo,
      };
    });

    if (huboCambios) {
      replace(productosHidratados as any);
    }
  }, [evento, form, insumosPorId, replace]);

  useEffect(() => {
    if (!watchedZafraId || !zafras || zafras.length === 0) return;
    const zafraSeleccionada = zafras.find((z) => z.id === watchedZafraId);
    const cultivoDesdeZafra = zafraSeleccionada?.cultivoId;
    if (!cultivoDesdeZafra) return;

    const cultivoActual = form.getValues("cultivoId");
    if (cultivoActual === cultivoDesdeZafra) return;

    form.setValue("cultivoId", cultivoDesdeZafra, {
      shouldValidate: true,
      shouldDirty: Boolean(cultivoActual),
    });
  }, [watchedZafraId, zafras, form]);

  useEffect(() => {
    if (usaCombustibleEnFormulario) return;

    const maquinariaIdActual = form.getValues("maquinariaId");
    const horometroAnteriorActual = form.getValues("horometroAnterior");
    const horometroActualValor = form.getValues("horometroActual");
    const noHayDatos =
      !maquinariaIdActual &&
      (horometroAnteriorActual === undefined || `${horometroAnteriorActual}` === "") &&
      (horometroActualValor === undefined || `${horometroActualValor}` === "");

    if (noHayDatos) return;

    form.setValue("maquinariaId", undefined, { shouldDirty: false, shouldValidate: false });
    form.setValue("horometroAnterior", undefined, { shouldDirty: false, shouldValidate: false });
    form.setValue("horometroActual", undefined, { shouldDirty: false, shouldValidate: false });
  }, [usaCombustibleEnFormulario, form]);

  useEffect(() => {
    if (!usaCombustibleEnFormulario || !maquinariaSeleccionada) return;

    const horasRegistradas = Number(maquinariaSeleccionada.horasTrabajo) || 0;
    const horometroAnteriorActual = form.getValues("horometroAnterior");
    const estaVacio =
      horometroAnteriorActual === undefined ||
      horometroAnteriorActual === null ||
      `${horometroAnteriorActual}` === "";
    const mantieneMaquinariaOriginal = Boolean(evento?.maquinariaId && watchedMaquinariaId === evento.maquinariaId);

    if (mantieneMaquinariaOriginal && !estaVacio) return;
    if (!estaVacio && Number(horometroAnteriorActual) === horasRegistradas) return;

    form.setValue("horometroAnterior", horasRegistradas, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [usaCombustibleEnFormulario, maquinariaSeleccionada, form, evento?.maquinariaId, watchedMaquinariaId]);

  const mostrarCuentaContable = useMemo(() => {
    return ['aplicacion', 'fertilización', 'plagas', 'siembra', 'cosecha', 'mantenimiento'].includes(tipoEventoNormalizado);
  }, [tipoEventoNormalizado]);

  const handleTipoEventoChange = useCallback((value: string) => {
    form.setValue('tipo', value as any);
    const tiposQueUsanCuenta = ['aplicacion', 'fertilización', 'plagas', 'siembra', 'cosecha', 'mantenimiento'];
    if (!tiposQueUsanCuenta.includes(value)) {
        form.setValue('cuentaContableId', null);
    }
}, [form]);

  useEffect(() => {
    if (evento || !mostrarCuentaContable || !planDeCuentas || planDeCuentas.length === 0) return;
    if (form.getValues("cuentaContableId")) return;

    const sugerida =
      findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.GASTOS_EVENTOS) ||
      planDeCuentas.find((cuenta) => cuenta.tipo === "gasto");

    if (sugerida?.id) {
      form.setValue("cuentaContableId", sugerida.id, { shouldDirty: false });
    }
  }, [evento, form, mostrarCuentaContable, planDeCuentas]);

  const hectareasCalculadas = Number(watchedHectareas) || 0;
  const totalInsumos = watchedProductos?.reduce((acc, prod) => {
    const dosis = Number(prod?.dosis) || 0;
    const insumoId = ((prod as any)?.insumoId || prod?.insumo?.id) as string | undefined;
    const insumoActual = insumoId ? (insumosPorId.get(insumoId) || prod?.insumo) : prod?.insumo;
    if (!insumoActual || dosis <= 0) {
      return acc;
    }
    const cantidad = hectareasCalculadas * dosis;
    const costoUnitario = Number(insumoActual.precioPromedioCalculado ?? insumoActual.costoUnitario ?? 0) || 0;
    return acc + (cantidad * costoUnitario);
  }, 0) || 0;
  const totalServicio = hectareasCalculadas * (Number(watchedCostoServicio) || 0);
  const totalEvento = totalInsumos + totalServicio;
  const costoPorHa = hectareasCalculadas > 0 ? totalEvento / hectareasCalculadas : 0;
  const parcelaSeleccionada = useMemo(
    () => (parcelas || []).find((parcela) => parcela.id === watchedParcelaId),
    [parcelas, watchedParcelaId]
  );
  const hectareasPlantadasRendimientoPreview = useMemo(
    () =>
      calcularHectareasPlantadasContexto({
        eventos: todosLosEventos || [],
        parcelaId: watchedParcelaId,
        cultivoId: watchedCultivoId,
        zafraId: watchedZafraId,
        superficieFallback: Number(parcelaSeleccionada?.superficie) || 0,
      }),
    [
      todosLosEventos,
      watchedParcelaId,
      watchedCultivoId,
      watchedZafraId,
      parcelaSeleccionada?.superficie,
    ]
  );
  const toneladasPreview = Number(watchedToneladas) || 0;
  const rendimientoTonHaPreview =
    esEventoCosecha && hectareasPlantadasRendimientoPreview > 0 && toneladasPreview > 0
      ? toneladasPreview / hectareasPlantadasRendimientoPreview
      : 0;
  const rendimientoKgHaPreview = rendimientoTonHaPreview * 1000;
  const horasTrabajadasPreview = useMemo(() => {
    if (!usaCombustibleEnFormulario) return 0;
    const anterior = Number(watchedHorometroAnterior) || 0;
    const actual = Number(watchedHorometroActual) || 0;
    if (actual < anterior) return 0;
    return actual - anterior;
  }, [usaCombustibleEnFormulario, watchedHorometroAnterior, watchedHorometroActual]);

  const analisisProps = useMemo(() => ({
    eventoActual: {
      ...form.getValues(),
      tipo: tipoEventoNormalizado,
      fecha: watchedFecha,
      parcelaId: watchedParcelaId,
      cultivoId: watchedCultivoId,
      zafraId: watchedZafraId,
    } as Evento,
    todosLosEventos: todosLosEventos || [],
    zafras: zafras || [],
    etapasCultivo: etapasCultivo || [],
  }), [
    tipoEventoNormalizado,
    watchedParcelaId,
    watchedCultivoId,
    watchedZafraId,
    watchedFecha,
    form,
    todosLosEventos,
    zafras,
    etapasCultivo,
  ]);


  const handleSubmit = async (data: EventoFormValues) => {
    if (!firestore || !user) return;
    
    setIsSubmitting(true);
    toast({ title: "Guardando evento...", description: "Por favor espere." });

    const tipoNormalizado = normalizarTipoEvento(data.tipo);
    const parcelaSeleccionada = parcelas?.find((parcela) => parcela.id === data.parcelaId);
    const hectareasBaseRendimiento = calcularHectareasPlantadasContexto({
      eventos: todosLosEventos || [],
      parcelaId: data.parcelaId,
      cultivoId: data.cultivoId,
      zafraId: data.zafraId,
      superficieFallback: Number(parcelaSeleccionada?.superficie) || 0,
    });
    const toneladasCosechadas = Number(data.toneladas) || 0;
    const rendimientoTonHa =
      tipoNormalizado === "cosecha" && hectareasBaseRendimiento > 0 && toneladasCosechadas > 0
        ? toneladasCosechadas / hectareasBaseRendimiento
        : 0;
    const rendimientoKgHa = rendimientoTonHa * 1000;
    const costoServicioTotalEvento =
      (Number(data.hectareasAplicadas) || 0) * (Number(data.costoServicioPorHa) || 0);
    const usaCombustible = tieneProductoCombustible(data.productos as Array<{ insumo?: Partial<Insumo> | null }> | undefined);
    const horometroAnterior = usaCombustible ? Number(data.horometroAnterior ?? 0) : undefined;
    const horometroActual = usaCombustible ? Number(data.horometroActual ?? 0) : undefined;
    const horasTrabajadas =
      usaCombustible && horometroAnterior !== undefined && horometroActual !== undefined
        ? Math.max(horometroActual - horometroAnterior, 0)
        : undefined;

    const productosFinal = data.productos?.map(p => {
        const consumoCalculado = (p.dosis || 0) * (data.hectareasAplicadas || 0);
        return {
            insumoId: p.insumo.id,
            dosis: p.dosis,
            cantidad: consumoCalculado,
        };
    });

    const dataConCostoTotal = {
      ...data,
      tipo: tipoNormalizado,
      estado: data.estado || 'pendiente',
      fotos: data.fotos || [],
      costoTotal: totalEvento,
      costoPorHa: costoPorHa,
      costoServicioTotal: costoServicioTotalEvento > 0 ? costoServicioTotalEvento : undefined,
      productos: productosFinal,
      maquinariaId: usaCombustible ? data.maquinariaId : undefined,
      horometroAnterior,
      horometroActual,
      horasTrabajadas,
      hectareasRendimiento: tipoNormalizado === "cosecha" ? hectareasBaseRendimiento : undefined,
      rendimientoTonHa: tipoNormalizado === "cosecha" ? rendimientoTonHa : undefined,
      rendimientoKgHa: tipoNormalizado === "cosecha" ? rendimientoKgHa : undefined,
    };
    try {
      await onSave(dataConCostoTotal);
      clearDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    clearDraft();
    form.reset({
        fecha: new Date(),
        tipo: 'aplicacion',
        productos: [],
        fotos: [],
        descripcion: "",
        hectareasAplicadas: '' as any,
        costoServicioPorHa: '' as any,
        temperatura: '' as any,
        humedad: '' as any,
        viento: '' as any,
        toneladas: '' as any,
        precioTonelada: '' as any,
        maquinariaId: undefined,
        horometroAnterior: '' as any,
        horometroActual: '' as any,
        resultado: '',
        cuentaContableId: null,
    });
    toast({
        title: 'Borrador descartado',
        description: 'El formulario se ha limpiado.',
    })
  }

  const handleApprove = () => {
    if (!user || !evento) return;
    const eventoRef = tenant.doc('eventos', evento.id);
    if (!eventoRef) return;
    updateDocumentNonBlocking(eventoRef, {
      estado: 'aprobado',
      aprobadoPor: user.uid,
      aprobadoPorNombre: usuarioApp?.nombre || user.email || user.uid,
      aprobadoEn: serverTimestamp(),
    });
    toast({ title: "Evento Aprobado", description: "El evento ha sido marcado como aprobado." });
    onCancel();
  }

  const handleReject = () => {
    if (!user || !evento) return;
    const motivo = form.getValues('motivoRechazo');
    if (!motivo || motivo.trim().length < 5) {
      form.setError('motivoRechazo', { type: 'manual', message: 'Debe ingresar un motivo de al menos 5 caracteres.' });
      return;
    }
    const eventoRef = tenant.doc('eventos', evento.id);
    if (!eventoRef) return;
    updateDocumentNonBlocking(eventoRef, {
      estado: 'rechazado',
      rechazadoPor: user.uid,
      rechazadoEn: serverTimestamp(),
      motivoRechazo: motivo,
    });
    toast({ title: "Evento Rechazado", variant: "destructive" });
    onCancel();
  };

  const handleFileAdd = (newFile: Foto) => {
    form.setValue('fotos', [...(form.getValues('fotos') || []), newFile], { shouldDirty: true });
  };

  const handleFileRemove = (storagePath: string) => {
    form.setValue('fotos', (form.getValues('fotos') || []).filter(f => f.storagePath !== storagePath), { shouldDirty: true });
  };


  if (!parcelas || !cultivos || !zafras || !etapasCultivo || !insumos) {
    return <p>Cargando datos maestros...</p>;
  }

  return (
    <>
      <EventoAnalisisPanel {...analisisProps} />

      {estadoActual === 'aprobado' && (
          <Card className="mb-6 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
              <CardHeader className="flex-row items-center gap-4 p-4">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400"/>
                  <div>
                      <CardTitle className="text-green-800 dark:text-green-300">Evento Aprobado</CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-400/80">
                          Este registro está cerrado y no puede ser modificado. Aprobado por <strong>{aprobadoPorNombre}</strong> el {evento?.aprobadoEn ? format(new Date((evento.aprobadoEn as any).seconds * 1000), 'dd/MM/yyyy HH:mm') : 'N/A'}.
                      </CardDescription>
                  </div>
              </CardHeader>
          </Card>
      )}

      {estadoActual === 'rechazado' && (
           <Card className="mb-6 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700">
               <CardHeader className="flex-row items-center gap-4 p-4">
                  <Ban className="w-6 h-6 text-red-600 dark:text-red-400"/>
                  <div>
                      <CardTitle className="text-red-800 dark:text-red-300">Evento Rechazado</CardTitle>
                      <CardDescription className="text-red-700 dark:text-red-400/80">
                          Motivo: <strong>{evento?.motivoRechazo}</strong>.
                      </CardDescription>
                  </div>
              </CardHeader>
           </Card>
      )}

      <Card className="max-w-full overflow-hidden">
        <CardContent className="mt-6 max-w-full overflow-x-hidden p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">
              <fieldset disabled={isFinalizado}>
                <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="parcelaId"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Parcela</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Parcela>
                            collectionName="parcelas"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={parcelas?.find(p => p.id === field.value)}
                            onSelect={(p) => field.onChange(p?.id)}
                            searchFields={['nombre', 'codigo', 'numeroItem']}
                            extraInfoFields={[
                              { label: 'Sup.', field: 'superficie', format: (val) => `${val} ha` },
                              { label: 'Estado', field: 'estado' },
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cultivoId"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Cultivo / Variedad</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Cultivo>
                            collectionName="cultivos"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={cultivos?.find(c => c.id === field.value)}
                            onSelect={(c) => field.onChange(c?.id)}
                            searchFields={['nombre', 'numeroItem']}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zafraId"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Zafra</FormLabel>
                        <FormControl>
                          <SelectorUniversal<Zafra>
                            collectionName="zafras"
                            displayField="nombre"
                            codeField="numeroItem"
                            value={zafras?.find(z => z.id === field.value)}
                            onSelect={(z) => field.onChange(z?.id)}
                            searchFields={['nombre', 'numeroItem']}
                            extraInfoFields={[
                              { label: 'Estado', field: 'estado'},
                              { label: 'Inicio', field: 'fechaInicio', format: (val) => format(new Date(val), 'dd/MM/yyyy') },
                            ]}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <FormField name="tipo" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Tipo de Evento</FormLabel><Select onValueChange={handleTipoEventoChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger></FormControl><SelectContent><SelectItem value="siembra">Siembra</SelectItem><SelectItem value="aplicacion">Aplicación</SelectItem><SelectItem value="fertilización">Fertilización</SelectItem><SelectItem value="riego">Riego</SelectItem><SelectItem value="cosecha">Cosecha</SelectItem>{field.value === "rendimiento" && <SelectItem value="rendimiento">Rendimiento (legado)</SelectItem>}<SelectItem value="mantenimiento">Mantenimiento</SelectItem><SelectItem value="plagas">Control de Plagas</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                  <FormField name="fecha" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Fecha del Evento</FormLabel><FormControl><Input type="date" lang="es-PY" value={dateToInputValue(field.value)} onChange={(e) => field.onChange(inputValueToDate(e.target.value))} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField name="descripcion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Describa el evento..." {...field} /></FormControl><FormMessage /></FormItem> )} />

                {mostrarCuentaContable && (
                  <FormField
                    control={form.control}
                    name="cuentaContableId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cuenta Contable de Costo (Opcional)</FormLabel>
                          <SelectorPlanDeCuentas
                              value={field.value}
                              onChange={field.onChange}
                              filter="gasto"
                          />
                        <FormDescription>Asocia este evento a una cuenta contable para el análisis de costos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {['aplicacion', 'fertilización', 'plagas', 'siembra'].includes(tipoEventoNormalizado) && (
                  <Card className="border-border/60">
                     <CardHeader className="p-4"><CardTitle className="text-lg">Detalles de Aplicación y Costos</CardTitle></CardHeader>
                     <CardContent className="p-4 pt-0 space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField name="hectareasAplicadas" control={form.control} render={({ field }) => (<FormItem><FormLabel>Hectáreas Aplicadas</FormLabel><FormControl><Input type="number" placeholder="Ej: 50" {...field} /></FormControl><FormMessage /></FormItem>)} />
                         <FormField name="costoServicioPorHa" control={form.control} render={({ field }) => (<FormItem><FormLabel>Costo de Servicio por Ha ($)</FormLabel><FormControl><Input type="number" placeholder="Ej: 15" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       </div>
                     </CardContent>
                  </Card>
                )}

                {['aplicacion', 'fertilización', 'plagas', 'siembra'].includes(tipoEventoNormalizado) && (
                  <Card className="bg-muted/30 p-4">
                    <CardHeader className="p-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Productos/Insumos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-4">
                       <InsumosTabla
                          fields={fields}
                          hectareas={watchedHectareas || 0}
                          append={append}
                          remove={remove}
                          form={form}
                       />
                    </CardContent>
                  </Card>
                )}

                 {['aplicacion', 'fertilización', 'plagas'].includes(tipoEventoNormalizado) && (
                   <div>
                     <FormLabel>Condiciones Climáticas</FormLabel>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 border p-4 rounded-md">
                        <FormField name="temperatura" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Temp (°C)</FormLabel><div className="relative"><Thermometer className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                        <FormField name="humedad" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Humedad (%)</FormLabel><div className="relative"><Cloud className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                        <FormField name="viento" control={form.control} render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Viento (km/h)</FormLabel><div className="relative"><Wind className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" className="pl-8" {...field} /></FormControl></div><FormMessage /></FormItem> )}/>
                     </div>
                   </div>
                )}

                {esEventoCosecha && (
                  <Card className="border-border/60">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">Detalles de Cosecha</CardTitle>
                      <CardDescription>
                        Registre hectareas cosechadas y costo de servicio por ha. El rendimiento se calcula como kg de grano / ha plantada en la zafra y cultivo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                        <FormField name="hectareasAplicadas" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Hectareas Cosechadas</FormLabel><FormControl><Input type="number" placeholder={`Ej: ${Number(parcelaSeleccionada?.superficie || 0).toLocaleString('de-DE')}`} {...field} /></FormControl><FormDescription>Dato obligatorio para calcular costo de cosecha.</FormDescription><FormMessage /></FormItem> )}/>
                        <FormField name="costoServicioPorHa" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Costo Servicio Cosecha por Ha (USD)</FormLabel><FormControl><Input type="number" placeholder="Ej: 65" {...field} /></FormControl><FormDescription>Dato obligatorio para valorizar el servicio.</FormDescription><FormMessage /></FormItem> )}/>
                        <FormField name="toneladas" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Toneladas Cosechadas</FormLabel><FormControl><Input type="number" placeholder="Ej: 150" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField name="precioTonelada" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Precio Referencial por Tonelada (USD)</FormLabel><FormControl><Input type="number" placeholder="Ej: 450" {...field} /></FormControl><FormDescription>Se usa para valorizacion contable del grano ingresado.</FormDescription><FormMessage /></FormItem> )}/>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-md border p-4 bg-muted/30">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Ha Plantada (Zafra/Cultivo)</p>
                          <p className="font-semibold">{hectareasPlantadasRendimientoPreview.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ha</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Rendimiento (ton/ha)</p>
                          <p className="font-semibold">{rendimientoTonHaPreview.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Rendimiento (kg/ha)</p>
                          <p className="font-semibold">{rendimientoKgHaPreview.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {usaCombustibleEnFormulario && (
                  <Card className="border-border/60">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">Control de Maquinaria para Combustible</CardTitle>
                      <CardDescription>
                        Seleccione la maquinaria por codigo. La hora anterior se trae desde el modulo de maquinarias y debe registrar la hora actual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <FormField
                        control={form.control}
                        name="maquinariaId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Codigo de Maquina / Maquinaria</FormLabel>
                            <FormControl>
                              <SelectorUniversal<Maquinaria>
                                label="maquinaria"
                                collectionName="maquinaria"
                                displayField="nombre"
                                codeField="numeroItem"
                                value={maquinarias?.find((maquinaria) => maquinaria.id === field.value)}
                                onSelect={(maquinaria) => field.onChange(maquinaria?.id)}
                                searchFields={["nombre", "numeroItem", "modelo"]}
                                extraInfoFields={[
                                  { label: "Horas", field: "horasTrabajo", format: (val) => `${val || 0} hs` },
                                  { label: "Estado", field: "estado" },
                                  { label: "Tipo", field: "tipo" },
                                ]}
                              />
                            </FormControl>
                            <FormDescription>
                              Use el Item N° de la maquinaria para cargar rapido el horometro.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="horometroAnterior"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hora Anterior</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} value={field.value ?? ""} readOnly />
                              </FormControl>
                              <FormDescription>
                                Ultimo horometro registrado para la maquinaria seleccionada.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="horometroActual"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hora Actual</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" placeholder="Ej: 1254.5" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormDescription>
                                Ingrese la lectura actual del horometro despues de cargar combustible.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Horas trabajadas
                          </p>
                          <p className="mt-2 text-2xl font-bold">
                            {horasTrabajadasPreview.toLocaleString("de-DE", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })} hs
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {maquinariaSeleccionada
                              ? `Maquina: ${maquinariaSeleccionada.nombre} (Item N° ${maquinariaSeleccionada.numeroItem || "-"})`
                              : "Seleccione una maquinaria para vincular el consumo."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <FormField control={form.control} name="resultado" render={({ field }) => (<FormItem><FormLabel>Resultado/Observaciones</FormLabel><FormControl><Textarea placeholder="Observaciones sobre el resultado de la labor..." {...field} /></FormControl><FormMessage /></FormItem>)} />

                <ImageUpload
                  onFileAdd={handleFileAdd}
                  onFileRemove={handleFileRemove}
                  existingFiles={form.watch('fotos') || []}
                  eventoId={evento?.id || 'temp'}
                  parcelaId={watchedParcelaId}
                />
              </fieldset>

              <div className="flex flex-col gap-4 pt-4">
                <div className="w-full">
                    <div className="flex w-full flex-col items-stretch gap-4 lg:flex-row">
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-background border border-primary/20">
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-sm text-muted-foreground">Valor Total de Ítems:</span>
                                <span className="font-mono font-semibold">${totalInsumos.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-sm text-muted-foreground">Costo de Servicio:</span>
                                <span className="font-mono font-semibold">${totalServicio.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 border-t pt-2 mt-1">
                                <span className="text-lg font-bold text-primary">Costo Total del Evento:</span>
                                <span className="text-xl font-bold text-primary font-mono">${totalEvento.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <Card className="flex flex-col items-center justify-center p-4 bg-primary/5 border-primary/20">
                           <CardHeader className="p-0 text-center">
                               <p className="text-sm text-muted-foreground">Costo por Hectárea</p>
                           </CardHeader>
                           <CardContent className="p-0">
                                <p className="text-2xl font-bold text-green-700 dark:text-green-500 font-mono">${costoPorHa.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                           </CardContent>
                        </Card>
                    </div>
                 </div>

                {draft && Object.keys(draft).length > 0 && !evento && (
                    <Button type="button" variant="ghost" onClick={handleDiscard} className="text-destructive hover:text-destructive">
                        <Eraser className="mr-2"/>
                        Descartar Borrador
                    </Button>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                    {!evento && <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Registrar Evento"}</Button>}
                </div>
              </div>
            </form>
          </Form>

          {evento && !isFinalizado && puedeAprobar && (
             <div className="mt-6 border-t pt-6">
                <div className="flex justify-end gap-4">
                    <AlertDialog open={isRejecting} onOpenChange={setIsRejecting}>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                              <Ban className="mr-2" />
                              Rechazar
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Rechazar Evento</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Por favor, ingrese el motivo del rechazo. Este será visible para el usuario que registró el evento.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Form {...form}>
                              <FormField
                                name="motivoRechazo"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Motivo del Rechazo</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Ej: La dosis aplicada no es la correcta para esta etapa..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                              />
                          </Form>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleReject}>Confirmar Rechazo</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button onClick={handleApprove}>
                        <Check className="mr-2" />
                        Aprobar Evento
                    </Button>
                </div>
             </div>
          )}

        </CardContent>
      </Card>
    </>
  );
}

