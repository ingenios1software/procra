import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/firebase/config"; // Asumiendo que esta es la forma de obtener la instancia de db
import type { Insumo } from "@/lib/types";

const REQUIRED_COLUMNS = ["Nombre", "Precio Promedio", "Categoria", "Unidad"];

type MappedRow = {
    nombre: string;
    principioActivo?: string;
    dosisRecomendada?: number;
    precioPromedio: number;
    categoria: 'fertilizante' | 'herbicida' | 'fungicida' | 'semilla' | 'insecticida' | 'otros';
    unidad: 'kg' | 'lt' | 'unidad' | 'ton';
    entradaTotal: number;
    salidaTotal: number;
    stockMinimo: number;
};

export async function importarStockDesdeExcel(file: File): Promise<{ success: boolean; errors: string[] }> {
    const XLSX = await import("xlsx");
    const errors: string[] = [];

    // 1. Leer el archivo
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (json.length === 0) {
        return { success: false, errors: ["El archivo Excel está vacío."] };
    }

    // 2. Validar columnas
    const firstRowHeaders = Object.keys(json[0]);
    const missingColumns = REQUIRED_COLUMNS.filter(col => !firstRowHeaders.includes(col));
    if (missingColumns.length > 0) {
        return { success: false, errors: [`Faltan columnas obligatorias en el Excel: ${missingColumns.join(", ")}`] };
    }

    // 3. Mapear y procesar filas
    const mappedData: MappedRow[] = [];
    for (const row of json) {
        if (!row["Nombre"]) continue; // Ignorar filas sin nombre

        const mappedRow: MappedRow = {
            nombre: row["Nombre"],
            principioActivo: row["Principio Activo"],
            dosisRecomendada: Number(row["Dosis Rec."]) || undefined,
            precioPromedio: Number(row["Precio Promedio"]),
            categoria: row["Categoria"]?.toLowerCase() || 'otros',
            unidad: row["Unid"]?.toLowerCase() || row["Unidad"]?.toLowerCase() || 'unidad',
            entradaTotal: Number(row["Entrada"] || 0),
            salidaTotal: Number(row["Salida"] || 0),
            stockMinimo: Number(row["StockMinimo"] || 0),
        };
        mappedData.push(mappedRow);
    }
    
    // 4. Procesar en Firestore
    try {
        const insumosCollection = collection(db, "insumos");
        const querySnapshot = await getDocs(insumosCollection);
        const existingInsumos = new Map(querySnapshot.docs.map(d => [d.data().nombre, { id: d.id, ...d.data() } as Insumo]));
        const batch = writeBatch(db);

        for (const item of mappedData) {
            const stockActual = item.entradaTotal - item.salidaTotal;
            const valorEnStock = stockActual * item.precioPromedio;

            const finalItemData = {
                nombre: item.nombre,
                principioActivo: item.principioActivo || "",
                dosisRecomendada: item.dosisRecomendada || 0,
                costoUnitario: item.precioPromedio, // Mapeado a costoUnitario
                categoria: item.categoria,
                unidad: item.unidad,
                stockActual: stockActual, // Este campo es el que se usa en la app
                stockMinimo: item.stockMinimo,
                // Los campos de valor se calculan en el frontend, no se guardan
            };

            const existing = existingInsumos.get(item.nombre);
            if (existing) {
                // Actualizar
                const docRef = doc(db, "insumos", existing.id);
                batch.update(docRef, finalItemData);
            } else {
                // Crear
                const docRef = doc(insumosCollection);
                batch.set(docRef, finalItemData);
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
