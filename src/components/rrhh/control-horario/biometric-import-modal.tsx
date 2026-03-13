"use client";

import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Deposito, Parcela } from "@/lib/types";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type BiometricImportPayload = {
  file: File;
  parcelaId: string;
  depositoId: string;
  precioHoraGs: number;
  baseDescription: string;
  matrixMonth: number;
  matrixYear: number;
  overwriteExisting: boolean;
};

export type BiometricImportResult = {
  success: boolean;
  summary: string;
  errors: string[];
};

interface BiometricImportModalProps {
  isOpen: boolean;
  parcelas: Parcela[];
  depositos: Deposito[];
  selectedMonth: number;
  selectedYear: number;
  years: number[];
  onClose: () => void;
  onImport: (payload: BiometricImportPayload) => Promise<BiometricImportResult>;
}

export function BiometricImportModal({
  isOpen,
  parcelas,
  depositos,
  selectedMonth,
  selectedYear,
  years,
  onClose,
  onImport,
}: BiometricImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parcelaId, setParcelaId] = useState<string>("");
  const [depositoId, setDepositoId] = useState<string>("");
  const [precioHoraGs, setPrecioHoraGs] = useState<number>(0);
  const [baseDescription, setBaseDescription] = useState<string>("Importado desde reloj biometrico");
  const [matrixMonth, setMatrixMonth] = useState<number>(selectedMonth);
  const [matrixYear, setMatrixYear] = useState<number>(selectedYear);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<BiometricImportResult | null>(null);

  const canImport = useMemo(
    () => !!file && !!parcelaId && !!depositoId && !isProcessing,
    [file, parcelaId, depositoId, isProcessing]
  );

  const handleClose = () => {
    setFile(null);
    setParcelaId("");
    setDepositoId("");
    setPrecioHoraGs(0);
    setBaseDescription("Importado desde reloj biometrico");
    setMatrixMonth(selectedMonth);
    setMatrixYear(selectedYear);
    setOverwriteExisting(true);
    setIsProcessing(false);
    setResult(null);
    onClose();
  };

  const handleImport = async () => {
    if (!file || !parcelaId || !depositoId) return;
    setIsProcessing(true);
    const response = await onImport({
      file,
      parcelaId,
      depositoId,
      precioHoraGs: Math.max(0, Math.round(Number(precioHoraGs) || 0)),
      baseDescription,
      matrixMonth,
      matrixYear,
      overwriteExisting,
    });
    setResult(response);
    setIsProcessing(false);
  };

  return (
    <Dialog modal={false} open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent draggable className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Importar archivo de reloj biometrico</DialogTitle>
          <DialogDescription>
            Cargue el archivo Excel/CSV del marcador para generar registros masivos de control horario usando el ID del empleado de la planilla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biometric-file">Archivo</Label>
            <Input
              id="biometric-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={isProcessing}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
              }}
            />
            {file && <p className="text-xs text-muted-foreground">Seleccionado: {file.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Depósito por defecto (LOCAL)</Label>
              <Select value={depositoId} onValueChange={setDepositoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un deposito" />
                </SelectTrigger>
                <SelectContent>
                  {depositos.map((deposito) => (
                    <SelectItem key={deposito.id} value={deposito.id}>
                      {deposito.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Parcela por defecto</Label>
              <Select value={parcelaId} onValueChange={setParcelaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una parcela" />
                </SelectTrigger>
                <SelectContent>
                  {parcelas.map((parcela) => (
                    <SelectItem key={parcela.id} value={parcela.id}>
                      {parcela.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Precio por hora por defecto (Gs, opcional)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={precioHoraGs}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setPrecioHoraGs(Number.isFinite(next) ? next : 0);
                }}
                placeholder="Ej: 14500"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripcion base</Label>
              <Input
                value={baseDescription}
                onChange={(event) => setBaseDescription(event.target.value)}
                placeholder="Importado desde reloj biometrico"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mes de referencia (formato matriz)</Label>
              <Select value={matrixMonth.toString()} onValueChange={(v) => setMatrixMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={name} value={index.toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano de referencia (formato matriz)</Label>
              <Select value={matrixYear.toString()} onValueChange={(v) => setMatrixYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Actualizar registros existentes</p>
              <p className="text-xs text-muted-foreground">
                Si existe ID de empleado + fecha, reemplaza actividades por las del archivo.
              </p>
            </div>
            <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
          </div>

          {result && (
            <div className={`rounded-md border p-3 ${result.success ? "border-green-200" : "border-red-200"}`}>
              <p className={`text-sm font-medium ${result.success ? "text-green-700" : "text-red-700"}`}>
                {result.summary}
              </p>
              {result.errors.length > 0 && (
                <ScrollArea className="h-28 mt-2 pr-2">
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={`${index}-${error}`}>- {error}</li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cerrar
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar archivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
