"use client";

import { StockList } from "@/components/stock/stock-list";
import { useCollection, useMemoFirebase } from "@/firebase";
import type { Insumo, LoteInsumo, CompraNormal } from "@/lib/types";
import { ImportModal } from "@/components/stock/import-modal";
import { useState } from "react";
import { importarStockDesdeExcel } from "@/lib/import/stock-importer";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

export default function StockPage() {
  const tenant = useTenantFirestore();
  const { toast } = useToast();

  const { data: insumos, isLoading, forceRefetch: refetchInsumos } = useCollection<Insumo>(
    useMemoFirebase(() => tenant.query("insumos"), [tenant])
  );
  const { data: lotes } = useCollection<LoteInsumo>(
    useMemoFirebase(() => tenant.query("lotesInsumos"), [tenant])
  );
  const { data: comprasNormal } = useCollection<CompraNormal>(
    useMemoFirebase(() => tenant.query("comprasNormal"), [tenant])
  );

  const [isImportModalOpen, setImportModalOpen] = useState(false);

  const handleImport = async (file: File) => {
    if (!tenant.firestore || !tenant.empresaId) {
      return { success: false, errors: ["No se pudo resolver la empresa actual."] };
    }

    const result = await importarStockDesdeExcel(file, tenant.firestore, tenant.empresaId);
    if (result.success) {
      toast({
        title: "Importacion Completada",
        description: "El stock de insumos fue actualizado correctamente.",
      });
      refetchInsumos();
      setImportModalOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error en la Importacion",
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
        comprasNormal={comprasNormal || []}
      />
      <ImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImport} />
    </>
  );
}
