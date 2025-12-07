import { collection, doc, getDoc, writeBatch, Firestore } from "firebase/firestore";
import type { Evento, Insumo, MovimientoStock, Parcela, Zafra, Cultivo } from "@/lib/types";

export async function procesarConsumoDeStockDesdeEvento(evento: Evento & { id: string }, db: Firestore, userId: string): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!evento.productos || evento.productos.length === 0 || !evento.hectareasAplicadas) {
        return { success: true, errors: [] }; // No hay insumos que procesar
    }

    const batch = writeBatch(db);

    const parcelaRef = doc(db, "parcelas", evento.parcelaId);
    const zafraRef = doc(db, "zafras", evento.zafraId);
    const cultivoRef = doc(db, "cultivos", evento.cultivoId);

    try {
        const [parcelaDoc, zafraDoc, cultivoDoc] = await Promise.all([
            getDoc(parcelaRef),
            getDoc(zafraRef),
            getDoc(cultivoRef),
        ]);

        const parcela = parcelaDoc.data() as Parcela;
        const zafra = zafraDoc.data() as Zafra;
        const cultivo = cultivoDoc.data() as Cultivo;

        for (const producto of evento.productos) {
            const insumoRef = doc(db, "insumos", producto.insumoId);
            const insumoDoc = await getDoc(insumoRef);

            if (!insumoDoc.exists()) {
                errors.push(`El insumo con ID ${producto.insumoId} no fue encontrado.`);
                continue;
            }

            const insumo = insumoDoc.data() as Insumo;
            const consumoCalculado = producto.dosis * (evento.hectareasAplicadas || 0);

            const stockAntes = insumo.stockActual || 0;
            const stockDespues = stockAntes - consumoCalculado;
            
            const precioUnitario = insumo.precioPromedioCalculado || insumo.costoUnitario || 0;

            // 1. Crear el documento de Movimiento de Stock
            const movimientoRef = doc(collection(db, "MovimientosStock"));
            const nuevoMovimiento: Omit<MovimientoStock, 'id'> = {
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
                stockAntes: stockAntes,
                stockDespues: stockDespues,
                precioUnitario: precioUnitario,
                costoTotal: consumoCalculado * precioUnitario,
                creadoPor: userId,
                creadoEn: new Date(), // Usar fecha del cliente para el registro de movimiento
            };
            batch.set(movimientoRef, nuevoMovimiento);

            // 2. Actualizar el stock del insumo
            batch.update(insumoRef, { stockActual: stockDespues });
            
            if (stockDespues < 0) {
                 errors.push(`Stock insuficiente para el insumo "${insumo.nombre}". El stock es ahora negativo.`);
            }
        }

        await batch.commit();

    } catch (e: any) {
        console.error("Error al procesar consumo de stock: ", e);
        return { success: false, errors: [`Error en la transacción: ${e.message}`] };
    }

    return { success: errors.length === 0, errors };
}
