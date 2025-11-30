"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ParcelaForm } from "./parcela-form";
import type { Parcela } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";

interface ParcelasListProps {
  parcelas: Parcela[];
  onAdd: (data: Omit<Parcela, 'id'>) => void;
  onUpdate: (data: Parcela) => void;
  onDelete: (id: string) => void;
}

export function ParcelasList({ parcelas, onAdd, onUpdate, onDelete }: ParcelasListProps) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null);
  const { user } = useAuth();
  const canModify = user && user.rol === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSave = (parcelaData: Parcela | Omit<Parcela, 'id'>) => {
    if ('id' in parcelaData) {
      onUpdate(parcelaData);
    } else {
      onAdd(parcelaData);
    }
    setFormOpen(false);
    setSelectedParcela(null);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
  };
  
  const openForm = (parcela?: Parcela) => {
    setSelectedParcela(parcela || null);
    setFormOpen(true);
  };
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        json.forEach((row: any) => {
          const newParcela: Omit<Parcela, 'id'> = {
            nombre: row['Nombre'] || 'Sin Nombre',
            codigo: row['Código'] || 'N/A',
            superficie: Number(row['Superficie']) || 0,
            ubicacion: row['Ubicación'] || 'N/A',
            estado: (row['Estado'] as Parcela['estado']) || 'activa',
            sector: row['Sector'] || undefined,
          };
          onAdd(newParcela);
        });

        toast({
          title: "Importación exitosa",
          description: `${json.length} parcelas han sido agregadas.`,
        });

      } catch (error) {
        console.error("Error al importar el archivo:", error);
        toast({
          variant: "destructive",
          title: "Error de importación",
          description: "No se pudo leer el archivo. Asegúrese de que el formato sea correcto.",
        });
      } finally {
        // Reset file input
        if(fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };


  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Gestione las parcelas de su establecimiento."
      >
        <div className="flex items-center gap-2">
           <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx, .xls, .csv"
            />
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
           {canModify && (
            <>
              <Button variant="outline" onClick={handleImportClick}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Excel
              </Button>
              <Button onClick={() => openForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Parcela
              </Button>
            </>
          )}
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Listado de Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Superficie (ha)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelas.map((parcela) => (
                <TableRow key={parcela.id}>
                  <TableCell className="font-medium">
                     <Link href={`/parcelas/${parcela.id}`} className="hover:underline text-primary">
                      {parcela.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{parcela.superficie}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={parcela.estado === 'activa' ? 'default' : parcela.estado === 'en barbecho' ? 'secondary' : 'outline'}
                      className={cn(
                        'capitalize',
                        parcela.estado === 'activa' && 'bg-green-600 text-white',
                        parcela.estado === 'en barbecho' && 'bg-yellow-500 text-black',
                        parcela.estado === 'inactiva' && 'bg-gray-400 text-white'
                      )}
                    >
                        {parcela.estado === 'en barbecho' ? 'En Barbecho' : parcela.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>{parcela.sector}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/parcelas/${parcela.id}`}>Ver Detalles</Link>
                        </DropdownMenuItem>
                        {canModify && (
                          <>
                            <DropdownMenuItem onClick={() => openForm(parcela)}>Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={e => e.preventDefault()}>Eliminar</DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción es permanente y eliminará la parcela. No se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(parcela.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedParcela ? 'Editar Parcela' : 'Crear Nueva Parcela'}</DialogTitle>
          </DialogHeader>
          <ParcelaForm 
            parcela={selectedParcela || undefined} 
            onSave={handleSave} 
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
