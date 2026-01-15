"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFirestore } from "@/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Insumo, CompraNormal } from "@/lib/types";
import { Loader2, Wrench, AlertTriangle } from "lucide-react";

export function RecalculatePrices() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleRecalculate = async () => {
        if (!firestore) {
            toast({ variant: "destructive", title: "Error", description: "La conexión con la base de datos no está disponible." });
            return;
        }

        setIsLoading(true);
        toast({ title: "Iniciando recálculo...", description: "Este proceso puede tardar unos minutos." });

        try {
            // 1. Obtener todos los insumos y todas las compras
            const insumosSnapshot = await getDocs(collection(firestore, "insumos"));
            const comprasSnapshot = await getDocs(collection(firestore, "comprasNormal"));

            const insumos = insumosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insumo));
            const compras = comprasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompraNormal));
            
            const batch = writeBatch(firestore);
            let updatedCount = 0;

            // 2. Iterar por cada insumo
            for (const insumo of insumos) {
                let cantidadTotal = 0;
                let importeTotal = 0;

                // 3. Buscar todas las compras de este insumo
                for (const compra of compras) {
                    if (compra.mercaderias) {
                        for (const item of compra.mercaderias) {
                            if (item.insumoId === insumo.id) {
                                const cantidad = Number(item.cantidad) || 0;
                                const valorUnitario = Number(item.valorUnitario) || 0;
                                
                                if (cantidad > 0 && valorUnitario > 0) {
                                    cantidadTotal += cantidad;
                                    importeTotal += cantidad * valorUnitario;
                                }
                            }
                        }
                    }
                }
                
                // 4. Calcular y preparar la actualización
                if (cantidadTotal > 0) {
                    const precioPromedioReal = importeTotal / cantidadTotal;
                    const insumoRef = doc(firestore, "insumos", insumo.id);
                    batch.update(insumoRef, { precioPromedioCalculado: precioPromedioReal });
                    updatedCount++;
                }
            }

            // 5. Ejecutar la actualización en lote
            await batch.commit();

            toast({
                title: "Recálculo completado",
                description: `Se actualizaron los precios de ${updatedCount} insumos.`,
            });

        } catch (error: any) {
            console.error("Error al recalcular precios:", error);
            toast({
                variant: "destructive",
                title: "Error en el recálculo",
                description: error.message || "Ocurrió un error inesperado.",
            });
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Mantenimiento de Datos de Insumos</CardTitle>
                <CardDescription>
                    Esta herramienta recalcula el precio promedio ponderado de todos los insumos basado en el historial de compras.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Acción Crítica</AlertTitle>
                    <AlertDescription>
                        Esta operación modificará los datos de precios de todos los insumos. Úsela solo si está seguro de que los precios promedio actuales son incorrectos. No se puede deshacer.
                    </AlertDescription>
                </Alert>
                <Button onClick={handleRecalculate} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
                    Ejecutar Recalculo de Precios Promedio
                </Button>
            </CardContent>
        </Card>
    );
}