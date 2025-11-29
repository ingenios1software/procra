"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Parcela } from "@/lib/types";
import { useUser, useFirestore, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
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
import { collection, doc } from 'firebase/firestore';

interface ParcelasListProps {
  parcelas: Parcela[];
  isLoading: boolean;
}

export function ParcelasList({ parcelas, isLoading }: ParcelasListProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const parcelaRef = doc(firestore, 'parcelas', id);
    deleteDocumentNonBlocking(parcelaRef);
  };
  
  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!firestore) return;
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

        const getColumnValue = (row: any, ...keys: string[]) => {
            for (const key of keys) {
                const rowKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
                if (rowKey && row[rowKey] !== undefined) {
                    return row[rowKey];
                }
            }
            return undefined;
        };
        
        const parcelasCol = collection(firestore, 'parcelas');
        const nuevasParcelas: Omit<Parcela, 'id'>[] = json.map((row) => ({
          nombre: getColumnValue(row, 'Nombre') || 'Sin Nombre',
          codigo: getColumnValue(row, 'Codigo') || 'N/A',
          superficie: Number(getColumnValue(row, 'Superficie')) || 0,
          ubicacion: getColumnValue(row, 'Ubicacion') || 'N/A',
          estado: (getColumnValue(row, 'Estado') as Parcela['estado']) || 'activa',
          sector: getColumnValue(row, 'Sector') || undefined,
        }));
        
        nuevasParcelas.forEach(parcela => {
          addDocumentNonBlocking(parcelasCol, parcela);
        })

        toast({
          title: "Importación exitosa",
          description: `${nuevasParcelas.length} parcelas han sido agregadas.`,
        });

      } catch (error) {
        console.error("Error al importar el archivo:", error);
        toast({
          variant: "destructive",
          title: "Error de importación",
          description: "No se pudo leer el archivo. Asegúrese de que el formato y las columnas sean correctos.",
        });
      } finally {
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
           {user && (
            <>
              <Button variant="outline" onClick={handleImportClick}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Excel
              </Button>
              <Button asChild>
                <Link href="/parcelas/crear">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Crear Parcela
                </Link>
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
              {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
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
                        {user && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link href={`/parcelas/editar/${parcela.id}`}>Editar</Link>
                            </DropdownMenuItem>
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
    </>
  );
}
