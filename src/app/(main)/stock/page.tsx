"use client";

import { StockList } from "@/components/stock/stock-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Insumo, Compra, Evento } from "@/lib/types";
import { ImportButton } from "@/components/stock/import-button";
import { ImportModal } from "@/components/stock/import-modal";
import { useState } from "react";
import { importarStockDesdeExcel } from "@/lib/import/stock-importer";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { PlusCircle } from "lucide-react";
import { InsumoForm } from "@/components/stock/insumo-form";

export default function StockPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { data: insumos, isLoading: l1, forceRefetch: refetchInsumos } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos')) : null, [firestore]));
  const { data: compras, isLoading: l2 } = useCollection<Compra>(useMemoFirebase(() => firestore ? query(collection(firestore, 'compras')) : null, [firestore]));
  const { data: eventos, isLoading: l3 } = useCollection<Evento>(useMemoFirebase(() => firestore ? query(collection(firestore, 'eventos')) : null, [firestore]));
  
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isFormOpen, setFormOpen] = useState(false);

  const handleImport = async (file: File) => {
    const result = await importarStockDesdeExcel(file);
    if (result.success) {
      toast({
        title: "Importación Completada",
        description: "El stock de insumos ha sido actualizado correctamente.",
      });
      refetchInsumos(); // Forzar la recarga de datos
      setImportModalOpen(false);
    } else {
       toast({
        variant: "destructive",
        title: "Error en la Importación",
        description: "Se encontraron problemas al procesar el archivo.",
      });
    }
    return result;
  };
  

  return (
    <>
      <StockList 
        insumos={insumos || []}
        compras={compras || []}
        eventos={eventos || []}
        isLoading={l1 || l2 || l3}
        onImportClick={() => setImportModalOpen(true)}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </>
  );
}
