import { collection, doc, getDocs, writeBatch, query, orderBy, limit } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import type { Insumo } from "@/lib/types";

// --- Mapeo de columnas flexibles ---
const COLUMN_ALIASES = {
    nombre: ["Nombre", "NOMBRE"],
    categoria: ["Categoria", "Categoría", "CATEGORIA"],
    unidad: ["Unidad", "UNIDAD", "Unid", "UNID", "UNI"],
    principioActivo: ["Principio Activo", "Principio activo", "PRINCIPIO ACTIVO"],
    dosisRecomendada: ["Dosis Rec.", "Dosis recomendada", "Dosis"],
    entrada: ["Entrada", "ENTRADA"],
    salida: ["Salida", "SALIDA"],
    stockMinimo: ["StockMinimo", "Stock Mínimo", "STOCK MINIMO"],
    numeroItem: ["Item", "Item Nº", "ITEM"],
};

// Helper para obtener el valor de una fila usando alias
function getCol(row: any, keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return null;
}

// Helper para verificar si al menos un alias de una columna requerida existe
function hasAnyColumn(headers: string[], aliases: string[]): boolean {
    return aliases.some(alias => headers.includes(alias));
}


export async function importarStockDesdeExcel(file: File): Promise<{ success: boolean; errors: string[] }> {
    const XLSX = await import("xlsx");
    const errors: string[] = [];
    const { firestore: db } = initializeFirebase();

    // 1. Leer el archivo
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (json.length === 0) {
        return { success: false, errors: ["El archivo Excel está vacío."] };
    }

    // 2. Validar columnas requeridas usando alias
    const headers = Object.keys(json[0]);
    const missingFields: string[] = [];
    if (!hasAnyColumn(headers, COLUMN_ALIASES.nombre)) missingFields.push("Nombre");

    if (missingFields.length > 0) {
        return { success: false, errors: [`Faltan columnas obligatorias en el Excel: ${missingFields.join(", ")}`] };
    }

    // 3. Obtener el último numeroItem para continuar la secuencia
    const insumosCollection = collection(db, "insumos");
    const q = query(insumosCollection, orderBy("numeroItem", "desc"), limit(1));
    const lastItemSnapshot = await getDocs(q);
    let maxNumeroItem = 0;
    if (!lastItemSnapshot.empty) {
        maxNumeroItem = lastItemSnapshot.docs[0].data().numeroItem || 0;
    }

    // 4. Mapear y procesar filas
    const mappedData = [];
    for (let i = 0; i < json.length; i++) {
        const row = json[i];
        
        const nombre = getCol(row, COLUMN_ALIASES.nombre);
        if (!nombre) {
            errors.push(`Fila ${i + 2}: Se ignoró la fila porque no tiene un valor en la columna 'Nombre'.`);
            continue; 
        }

        const categoriaRaw = getCol(row, COLUMN_ALIASES.categoria)?.toLowerCase() || 'otros';
        const unidadRaw = getCol(row, COLUMN_ALIASES.unidad)?.toLowerCase() || 'unidad';

        const mappedRow = {
            nombre,
            principioActivo: getCol(row, COLUMN_ALIASES.principioActivo),
            dosisRecomendada: Number(getCol(row, COLUMN_ALIASES.dosisRecomendada)) || 0,
            categoria: ['fertilizante', 'herbicida', 'fungicida', 'semilla', 'insecticida'].includes(categoriaRaw) ? categoriaRaw : 'otros',
            unidad: ['kg', 'lt', 'ton'].includes(unidadRaw) ? unidadRaw : 'unidad',
            entradaTotal: Number(getCol(row, COLUMN_ALIASES.entrada) || 0),
            salidaTotal: Number(getCol(row, COLUMN_ALIASES.salida) || 0),
            stockMinimo: Number(getCol(row, COLUMN_ALIASES.stockMinimo) || 0),
            numeroItem: Number(getCol(row, COLUMN_ALIASES.numeroItem)) || 0, // Obtener el numeroItem si existe
        };
        mappedData.push(mappedRow);
    }
    
    // 5. Procesar en Firestore
    try {
        const querySnapshot = await getDocs(collection(db, "insumos"));
        const existingInsumos = new Map(querySnapshot.docs.map(d => [d.data().nombre, { id: d.id, ...d.data() } as Insumo]));
        const batch = writeBatch(db);

        for (const item of mappedData) {
            const stockActual = item.entradaTotal - item.salidaTotal;
            const existing = existingInsumos.get(item.nombre);

            let numeroItemAsignado;
            if (existing && existing.numeroItem) {
                numeroItemAsignado = existing.numeroItem;
            } else if (item.numeroItem > 0 && !Array.from(existingInsumos.values()).some(ins => ins.numeroItem === item.numeroItem)) {
                numeroItemAsignado = item.numeroItem;
            } else {
                maxNumeroItem++;
                numeroItemAsignado = maxNumeroItem;
            }

            const finalItemData = {
                nombre: item.nombre,
                principioActivo: item.principioActivo || null,
                dosisRecomendada: item.dosisRecomendada || null,
                categoria: item.categoria,
                unidad: item.unidad,
                stockActual: stockActual,
                stockMinimo: item.stockMinimo,
                costoUnitario: existing?.costoUnitario || 0,
                numeroItem: numeroItemAsignado,
            };

            if (existing) {
                const docRef = doc(db, "insumos", existing.id);
                batch.update(docRef, finalItemData);
            } else {
                const docRef = doc(insumosCollection);
                batch.set(docRef, { ...finalItemData, precioPromedioCalculado: 0 }); // Para nuevos, el precio es 0
            }
        }

        await batch.commit();

    } catch (e: any) {
        errors.push(`Error al guardar en Firestore: ${e.message}`);
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    return { success: true, errors: [] };
}
