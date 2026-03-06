"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, FileCheck } from "lucide-react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<{ success: boolean; errors: string[] }>;
}

type PreviewData = Record<string, any>[];

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportErrors([]);
      setSelectedFile(file);
      await generatePreview(file);
    }
  };

  const generatePreview = async (file: File) => {
    const XLSX = await import("xlsx");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        if (json.length > 0) {
          setHeaders(Object.keys(json[0]));
        }
        setPreviewData(json);
      } catch (error) {
        setImportErrors(["Error al leer el archivo. Asegúrese de que el formato sea correcto."]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportClick = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setImportErrors([]);
    const result = await onImport(selectedFile);
    setIsProcessing(false);

    if (!result.success) {
      setImportErrors(result.errors);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setHeaders([]);
    setImportErrors([]);
    setIsProcessing(false);
    onClose();
  }

  return (
    <Dialog modal={false} open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent draggable className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Insumos desde Excel</DialogTitle>
          <DialogDescription>
            Seleccione un archivo .xlsx o .xls para importar. La primera fila debe contener los encabezados.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {selectedFile && <p className="text-sm text-muted-foreground">Archivo: {selectedFile.name}</p>}
        </div>

        {importErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error de Importación</AlertTitle>
            <ScrollArea className="h-24">
                <AlertDescription>
                {importErrors.map((error, index) => (
                    <p key={index}>- {error}</p>
                ))}
                </AlertDescription>
            </ScrollArea>
          </Alert>
        )}

        {previewData.length > 0 ? (
          <div className="flex-grow overflow-hidden">
            <h3 className="text-lg font-medium mb-2">Vista Previa de Datos</h3>
            <ScrollArea className="h-full border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    {headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {headers.map((header) => (
                        <TableCell key={`${rowIndex}-${header}`}>{String(row[header] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
            <div className="flex-grow flex items-center justify-center border-2 border-dashed rounded-md">
                <div className="text-center text-muted-foreground">
                    <FileCheck className="mx-auto h-12 w-12" />
                    <p>Seleccione un archivo para ver la vista previa.</p>
                </div>
            </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleImportClick} disabled={!selectedFile || isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importar {previewData.length > 0 ? `${previewData.length} registros` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
