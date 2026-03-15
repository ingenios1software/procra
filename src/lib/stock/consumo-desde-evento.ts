import { collection, doc, getDoc, getDocs, query, where, writeBatch, Firestore } from "firebase/firestore";
import type {
  AsientoDiario,
  Cultivo,
  Evento,
  Insumo,
  MovimientoStock,
  Parcela,
  PlanDeCuenta,
  RendimientoAgricola,
  StockGrano,
  Zafra,
} from "@/lib/types";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo } from "@/lib/contabilidad/cuentas-base";
import { withZafraContext } from "@/lib/contabilidad/asientos";
import { tenantCollection, tenantDoc } from "@/lib/tenant";
import { getTipoBaseFromEvento } from "@/lib/eventos/tipos";
import {
  CATEGORIA_GRANO,
  buildGranoInsumoCodigo,
  buildGranoInsumoId,
  buildStockGranoDocId,
  calcularPrecioPromedioPonderado,
  toNumber,
  toPositiveNumber,
} from "@/lib/stock/granos";

function esEventoConIngresoDeGrano(tipo: Evento["tipo"]): boolean {
  return getTipoBaseFromEvento(tipo) === "cosecha";
}

function normalizarTexto(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scopedCollection(db: Firestore, empresaId: string | null | undefined, collectionName: string) {
  return empresaId ? tenantCollection(db, empresaId, collectionName) : collection(db, collectionName);
}

function scopedDoc(db: Firestore, empresaId: string | null | undefined, collectionName: string, documentId: string) {
  return empresaId ? tenantDoc(db, empresaId, collectionName, documentId) : doc(db, collectionName, documentId);
}

async function obtenerHectareasPlantadasContexto(
  db: Firestore,
  empresaId: string | null | undefined,
  {
    zafraId,
    cultivoId,
    parcelaId,
    superficieFallback,
  }: {
    zafraId: string;
    cultivoId: string;
    parcelaId: string;
    superficieFallback?: number;
  }
): Promise<number> {
  const eventosZafraQuery = query(scopedCollection(db, empresaId, "eventos"), where("zafraId", "==", zafraId));
  const eventosZafraSnap = await getDocs(eventosZafraQuery);

  let hectareasSiembra = 0;
  eventosZafraSnap.forEach((eventoDoc) => {
    const eventoData = eventoDoc.data() as Evento;
    if (eventoData.parcelaId !== parcelaId) return;
    if (eventoData.cultivoId !== cultivoId) return;
    if (getTipoBaseFromEvento(eventoData.tipo) !== "siembra") return;

    const hectareasEvento = toPositiveNumber(eventoData.hectareasAplicadas);
    if (hectareasEvento > hectareasSiembra) {
      hectareasSiembra = hectareasEvento;
    }
  });

  if (hectareasSiembra > 0) return hectareasSiembra;
  return toPositiveNumber(superficieFallback);
}

function buildRendimientoDocId(zafraId: string, cultivoId: string, parcelaId: string): string {
  return `${zafraId}__${cultivoId}__${parcelaId}`;
}

function buildEventoDocumento(evento: Evento & { id: string }): string {
  return evento.numeroLanzamiento ? `EV-${evento.numeroLanzamiento}` : evento.id;
}

export async function procesarConsumoDeStockDesdeEvento(
  evento: Evento & { id: string },
  db: Firestore,
  userId: string,
  empresaId?: string | null
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  const hectareasAplicadas = toPositiveNumber(evento.hectareasAplicadas);
  const productos = evento.productos || [];
  const debeProcesarConsumo = productos.length > 0 && !esEventoConIngresoDeGrano(evento.tipo);

  const toneladasCosechadas = toPositiveNumber(evento.toneladas);
  const debeProcesarCosecha = esEventoConIngresoDeGrano(evento.tipo) && toneladasCosechadas > 0;

  if (!debeProcesarConsumo && !debeProcesarCosecha) {
    return { success: true, errors: [] };
  }

  const eventoRef = scopedDoc(db, empresaId, "eventos", evento.id);
  const batch = writeBatch(db);
  const parcelaRef = scopedDoc(db, empresaId, "parcelas", evento.parcelaId);
  const cultivoRef = scopedDoc(db, empresaId, "cultivos", evento.cultivoId);
  const zafraRef = scopedDoc(db, empresaId, "zafras", evento.zafraId);

  try {
    const [eventoDoc, parcelaDoc, cultivoDoc, zafraDoc] = await Promise.all([
      getDoc(eventoRef),
      getDoc(parcelaRef),
      getDoc(cultivoRef),
      getDoc(zafraRef),
    ]);

    const eventoPersistido = eventoDoc.exists() ? (eventoDoc.data() as Evento) : null;
    if (eventoPersistido?.stockProcesadoEn) {
      return { success: true, errors: [] };
    }

    const parcela = parcelaDoc.data() as Parcela | undefined;
    const cultivo = cultivoDoc.data() as Cultivo | undefined;
    const zafra = zafraDoc.data() as Zafra | undefined;
    const eventoUpdates: Record<string, unknown> = {
      stockProcesadoEn: new Date().toISOString(),
      stockProcesadoPor: userId,
    };

    if (debeProcesarConsumo) {
      for (const producto of productos) {
        const insumoRef = scopedDoc(db, empresaId, "insumos", producto.insumoId);
        const insumoDoc = await getDoc(insumoRef);

        if (!insumoDoc.exists()) {
          errors.push(`El insumo con ID ${producto.insumoId} no fue encontrado.`);
          continue;
        }

        const insumo = insumoDoc.data() as Insumo;
        const consumoCalculado = toPositiveNumber(producto.cantidad) || toPositiveNumber(producto.dosis) * hectareasAplicadas;
        if (consumoCalculado <= 0) continue;

        const stockAntes = toNumber(insumo.stockActual);
        const stockDespues = stockAntes - consumoCalculado;
        const precioUnitario = toPositiveNumber(insumo.precioPromedioCalculado || insumo.costoUnitario);

        const movimientoRef = doc(scopedCollection(db, empresaId, "MovimientosStock"));
        const nuevoMovimiento: Omit<MovimientoStock, "id"> = {
          fecha: new Date(evento.fecha as string),
          tipo: "salida",
          origen: "evento",
          eventoId: evento.id,
          parcelaId: evento.parcelaId,
          parcelaNombre: parcela?.nombre,
          zafraId: evento.zafraId,
          cultivo: cultivo?.nombre,
          insumoId: producto.insumoId,
          insumoNombre: insumo.nombre,
          unidad: insumo.unidad,
          categoria: insumo.categoria,
          cantidad: consumoCalculado,
          stockAntes,
          stockDespues,
          precioUnitario,
          costoTotal: consumoCalculado * precioUnitario,
          creadoPor: userId,
          creadoEn: new Date(),
        };
        batch.set(movimientoRef, nuevoMovimiento);
        batch.update(insumoRef, { stockActual: stockDespues });

        if (stockDespues < 0) {
          errors.push(`Stock insuficiente para el insumo "${insumo.nombre}". El stock es ahora negativo.`);
        }
      }
    }

    if (debeProcesarCosecha) {
      const documentoEvento = buildEventoDocumento(evento);
      const insumoGranoRef = scopedDoc(db, empresaId, "insumos", buildGranoInsumoId(evento.cultivoId));
      const insumoGranoDoc = await getDoc(insumoGranoRef);

      const precioReferenciaEvento = toPositiveNumber(evento.precioTonelada);
      let insumoGrano: Partial<Insumo>;

      if (insumoGranoDoc.exists()) {
        insumoGrano = insumoGranoDoc.data() as Insumo;
      } else {
        const nombreCultivo = cultivo?.nombre || `Cultivo ${evento.cultivoId}`;
        insumoGrano = {
          nombre: `Grano de ${nombreCultivo}`,
          codigo: buildGranoInsumoCodigo(nombreCultivo, evento.cultivoId),
          descripcion: `Grano a granel de ${nombreCultivo}`,
          categoria: CATEGORIA_GRANO,
          unidad: "ton",
          iva: "0",
          costoUnitario: precioReferenciaEvento,
          precioPromedioCalculado: precioReferenciaEvento,
          precioVenta: precioReferenciaEvento,
          stockMinimo: 0,
          stockActual: 0,
        };
      }

      const stockAntesGrano = toNumber(insumoGrano.stockActual);
      const precioPromedioAntes = toPositiveNumber(
        insumoGrano.precioPromedioCalculado || insumoGrano.costoUnitario || precioReferenciaEvento
      );
      const precioIngreso = toPositiveNumber(evento.precioTonelada) || precioPromedioAntes;
      const stockDespuesGrano = stockAntesGrano + toneladasCosechadas;
      const precioPromedioDespues = calcularPrecioPromedioPonderado(
        Math.max(0, stockAntesGrano),
        precioPromedioAntes,
        toneladasCosechadas,
        precioIngreso || precioPromedioAntes
      );

      batch.set(
        insumoGranoRef,
        {
          ...insumoGrano,
          categoria: CATEGORIA_GRANO,
          unidad: "ton",
          iva: insumoGrano.iva || "0",
          stockActual: stockDespuesGrano,
          costoUnitario: precioIngreso || precioPromedioDespues,
          precioPromedioCalculado: precioPromedioDespues,
          precioVenta: toPositiveNumber(insumoGrano.precioVenta) || precioIngreso || precioPromedioDespues,
        },
        { merge: true }
      );

      const precioMovimiento = precioIngreso || precioPromedioDespues;
      const movimientoGranoRef = doc(scopedCollection(db, empresaId, "MovimientosStock"));
      const movimientoGrano: Omit<MovimientoStock, "id"> = {
        fecha: new Date(evento.fecha as string),
        tipo: "entrada",
        origen: "evento",
        eventoId: evento.id,
        documentoOrigen: documentoEvento,
        parcelaId: evento.parcelaId,
        parcelaNombre: parcela?.nombre || null,
        zafraId: evento.zafraId,
        cultivo: cultivo?.nombre || null,
        insumoId: insumoGranoRef.id,
        insumoNombre: (insumoGrano.nombre as string) || `Grano de ${cultivo?.nombre || "Cultivo"}`,
        unidad: "ton",
        categoria: CATEGORIA_GRANO,
        cantidad: toneladasCosechadas,
        stockAntes: stockAntesGrano,
        stockDespues: stockDespuesGrano,
        precioUnitario: precioMovimiento,
        costoTotal: toneladasCosechadas * precioMovimiento,
        creadoPor: userId,
        creadoEn: new Date(),
      };
      batch.set(movimientoGranoRef, movimientoGrano);

      const stockGranoRef = scopedDoc(
        db,
        empresaId,
        "stockGranos",
        buildStockGranoDocId(insumoGranoRef.id, evento.zafraId, evento.parcelaId)
      );
      const stockGranoDoc = await getDoc(stockGranoRef);
      const stockGranoActual = stockGranoDoc.exists() ? (stockGranoDoc.data() as StockGrano) : null;

      const stockContextoAntes = toNumber(stockGranoActual?.stockActual);
      const precioContextoAntes = toPositiveNumber(stockGranoActual?.precioPromedio || precioPromedioAntes);
      const stockContextoDespues = stockContextoAntes + toneladasCosechadas;
      const precioContextoDespues = calcularPrecioPromedioPonderado(
        Math.max(0, stockContextoAntes),
        precioContextoAntes,
        toneladasCosechadas,
        precioMovimiento || precioContextoAntes
      );

      const resumenStockGrano: Omit<StockGrano, "id"> = {
        insumoId: insumoGranoRef.id,
        insumoNombre: (insumoGrano.nombre as string) || `Grano de ${cultivo?.nombre || "Cultivo"}`,
        zafraId: evento.zafraId,
        parcelaId: evento.parcelaId,
        parcelaNombre: parcela?.nombre || null,
        cultivoId: evento.cultivoId || null,
        cultivoNombre: cultivo?.nombre || null,
        unidad: "ton",
        stockActual: stockContextoDespues,
        precioPromedio: precioContextoDespues,
        valorTotal: stockContextoDespues * precioContextoDespues,
        creadoEn: stockGranoActual?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: userId,
      };
      batch.set(stockGranoRef, resumenStockGrano, { merge: true });

      const hectareasPlantadasContexto = await obtenerHectareasPlantadasContexto(db, empresaId, {
        zafraId: evento.zafraId,
        cultivoId: evento.cultivoId,
        parcelaId: evento.parcelaId,
        superficieFallback: toPositiveNumber(parcela?.superficie),
      });
      const rendimientoTonHaEvento =
        hectareasPlantadasContexto > 0 ? toneladasCosechadas / hectareasPlantadasContexto : 0;
      const rendimientoKgHaEvento = rendimientoTonHaEvento * 1000;

      eventoUpdates.hectareasRendimiento = hectareasPlantadasContexto;
      eventoUpdates.rendimientoTonHa = rendimientoTonHaEvento;
      eventoUpdates.rendimientoKgHa = rendimientoKgHaEvento;

      const rendimientoRef = scopedDoc(
        db,
        empresaId,
        "rendimientosAgricolas",
        buildRendimientoDocId(evento.zafraId, evento.cultivoId, evento.parcelaId)
      );
      const rendimientoDoc = await getDoc(rendimientoRef);
      const rendimientoActual = rendimientoDoc.exists()
        ? (rendimientoDoc.data() as RendimientoAgricola)
        : null;

      const toneladasAcumAntes = toPositiveNumber(rendimientoActual?.toneladasAcumuladas);
      const toneladasAcumDespues = toneladasAcumAntes + toneladasCosechadas;
      const hectareasBaseAnterior = toPositiveNumber(rendimientoActual?.hectareasBase);
      const hectareasBase =
        hectareasPlantadasContexto > 0 ? hectareasPlantadasContexto : hectareasBaseAnterior;
      const rendimientoTonHa = hectareasBase > 0 ? toneladasAcumDespues / hectareasBase : 0;
      const rendimientoKgHa = rendimientoTonHa * 1000;

      const resumenRendimiento: Omit<RendimientoAgricola, "id"> = {
        zafraId: evento.zafraId,
        cultivoId: evento.cultivoId,
        parcelaId: evento.parcelaId,
        zafraNombre: zafra?.nombre || null,
        cultivoNombre: cultivo?.nombre || null,
        parcelaNombre: parcela?.nombre || null,
        hectareasBase: hectareasBase,
        toneladasAcumuladas: toneladasAcumDespues,
        kilosAcumulados: toneladasAcumDespues * 1000,
        rendimientoTonHa,
        rendimientoKgHa,
        ultimoEventoId: evento.id,
        ultimaFecha: evento.fecha,
        creadoEn: rendimientoActual?.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
        actualizadoPor: userId,
      };
      batch.set(rendimientoRef, resumenRendimiento, { merge: true });

      const costoServicioTotal = toPositiveNumber(evento.costoServicioTotal)
        || (toPositiveNumber(evento.hectareasAplicadas) * toPositiveNumber(evento.costoServicioPorHa));

      if (costoServicioTotal > 0) {
        eventoUpdates.costoServicioTotal = costoServicioTotal;

        const planCuentasSnap = await getDocs(scopedCollection(db, empresaId, "planDeCuentas"));
        const planDeCuentas: PlanDeCuenta[] = planCuentasSnap.docs.map((item) => ({
          ...(item.data() as Omit<PlanDeCuenta, "id">),
          id: item.id,
        }));

        const cuentaGastoId =
          evento.cuentaContableId
          || findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.GASTOS_EVENTOS)?.id
          || planDeCuentas.find((cuenta) => cuenta.tipo === "gasto")?.id;
        const cuentaServicioCosechaId =
          findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.OBLIGACIONES_SERVICIO_COSECHA)?.id
          || planDeCuentas.find((cuenta) => {
            const texto = normalizarTexto(`${cuenta.codigo} ${cuenta.nombre}`);
            const esPasivoAcreedor = cuenta.tipo === "pasivo" && cuenta.naturaleza === "acreedora";
            const refiereServicioCosecha = texto.includes("servicio") && texto.includes("cosecha");
            const refiereObligacion = texto.includes("obligac") || texto.includes("pagar") || texto.includes("proveedor");
            return esPasivoAcreedor && refiereServicioCosecha && refiereObligacion;
          })?.id
          || findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id
          || planDeCuentas.find((cuenta) => cuenta.tipo === "pasivo" && cuenta.naturaleza === "acreedora")?.id;

        if (cuentaServicioCosechaId === findPlanCuentaByCodigo(planDeCuentas, CODIGOS_CUENTAS_BASE.PROVEEDORES)?.id) {
          errors.push(
            `Se uso cuenta de Proveedores como contrapartida de servicio de cosecha (${documentoEvento}). Configure una cuenta especifica si desea separarlo.`
          );
        }

        if (cuentaServicioCosechaId && cuentaGastoId) {
          const asientoServicioRef = doc(scopedCollection(db, empresaId, "asientosDiario"));
          const asientoServicio: Omit<AsientoDiario, "id"> = withZafraContext({
            fecha: new Date(evento.fecha as string).toISOString(),
            descripcion: `Costo servicio cosecha ${documentoEvento} - ${cultivo?.nombre || "Cultivo"}`,
            movimientos: [
              { cuentaId: cuentaGastoId, tipo: "debe", monto: costoServicioTotal },
              { cuentaId: cuentaServicioCosechaId, tipo: "haber", monto: costoServicioTotal },
            ],
          }, {
            zafraId: evento.zafraId,
            zafraNombre: zafra?.nombre || null,
          });
          batch.set(asientoServicioRef, asientoServicio);
          eventoUpdates.asientoCosechaServicioId = asientoServicioRef.id;
        } else {
          errors.push(
            `No se genero el asiento del servicio de cosecha (${documentoEvento}) por falta de cuentas contables base.`
          );
        }
      }
    }

    batch.set(eventoRef, eventoUpdates, { merge: true });
    await batch.commit();
  } catch (e: any) {
    console.error("Error al procesar stock desde evento: ", e);
    return { success: false, errors: [`Error en la transaccion: ${e.message}`] };
  }

  return { success: errors.length === 0, errors };
}
