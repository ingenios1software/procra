"use client";

import { StockList } from "@/components/stock/stock-list";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Insumo, LoteInsumo } from "@/lib/types";
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
  
  const { data: insumos, isLoading, forceRefetch: refetchInsumos } = useCollection<Insumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'insumos')) : null, [firestore]));
  const { data: lotes } = useCollection<LoteInsumo>(useMemoFirebase(() => firestore ? query(collection(firestore, 'lotesInsumos')) : null, [firestore]));
  
  const [isImportModalOpen, setImportModalOpen] = useState(false);

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
        isLoading={isLoading}
        onImportClick={() => setImportModalOpen(true)}
        lotes={lotes || []}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImport}
      />
    </>
  );
}
