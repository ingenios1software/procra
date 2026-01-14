
"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, AlertCircle, Package, DollarSign, ArrowDown, ArrowUp, Trash2, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insumo, Compra, Evento } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { InsumoForm } from "./insumo-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "../shared/page-header";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { collection, doc, getDocs, query, orderBy, limit, writeBatch } from "firebase/firestore";
import { ImportButton } from "./import-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface StockListProps {
  insumos: Insumo[];
  compras: Compra[];
  eventos: Evento[];
  isLoading: boolean;
  onImportClick: () => void;
}

export function StockList({ insumos, compras, eventos, isLoading, onImportClick }: StockListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [isDeleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");


  const [filters, setFilters] = useState({
    nombre: '',
    categoria: '',
    principioActivo: '',
    numeroItem: '',
  });

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const stockData = useMemo(() => {
    if (!insumos || !compras || !eventos) return [];
    
    const preciosCalculados: Record<string, number> = {};
    insumos.forEach(insumo => {
        const comprasDelInsumo = compras
            .flatMap(c => c.items)
            .filter(item => item.insumoId === insumo.id);
        
        const totalCantidadComprada = comprasDelInsumo.reduce((sum, item) => sum + item.cantidad, 0);
        const totalValorComprado = comprasDelInsumo.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);

        preciosCalculados[insumo.id] = totalCantidadComprada > 0 ? totalValorComprado / totalCantidadComprada : 0;
    });

    const allEvents: (
      { type: 'entrada'; fecha: Date; insumoId: string; cantidad: number; } |
      { type: 'salida'; fecha: Date; insumoId: string; cantidad: number; }
    )[] = [];

    compras.forEach(compra => {
        compra.items.forEach(item => {
            allEvents.push({ type: 'entrada', fecha: new Date(compra.fecha as string), insumoId: item.insumoId, cantidad: item.cantidad });
        });
    });

    eventos.forEach(evento => {
        evento.productos?.forEach(prod => {
            allEvents.push({ type: 'salida', fecha: new Date(evento.fecha as string), insumoId: prod.insumoId, cantidad: prod.cantidad });
        });
    });
    
    allEvents.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const calculatedInsumos = insumos.map(insumo => {
        let currentStock = insumo.stockActual;
        let entradaTotal = 0;
        let salidaTotal = 0;
        
        const insumoMovements = allEvents.filter(e => e.insumoId === insumo.id);
        
        insumoMovements.forEach(mov => {
            if (mov.type === 'entrada') {
                entradaTotal += mov.cantidad;
            } else if (mov.type === 'salida') {
                salidaTotal += mov.cantidad;
            }
        });
        
        currentStock = (insumo.stockActual || 0) + entradaTotal - salidaTotal;
        
        const precioPromedioCalculado = preciosCalculados[insumo.id] || 0;
        const valorStock = currentStock * precioPromedioCalculado;

        return {
            ...insumo,
            entradaTotal,
            salidaTotal,
            stockFinal: currentStock,
            precioPromedioCalculado,
            valorStock,
        };
    });

    return calculatedInsumos;
  }, [insumos, compras, eventos]);
  
  const filteredStockData = useMemo(() => {
    return stockData.filter(insumo => {
      const nombreMatch = insumo.nombre.toLowerCase().includes(filters.nombre.toLowerCase());
      const categoriaMatch = filters.categoria ? insumo.categoria === filters.categoria : true;
      const principioActivoMatch = insumo.principioActivo ? insumo.principioActivo.toLowerCase().includes(filters.principioActivo.toLowerCase()) : true;
      const numeroItemMatch = filters.numeroItem ? insumo.numeroItem?.toString().includes(filters.numeroItem) : true;
      
      if (filters.principioActivo && !insumo.principioActivo) return false;

      return nombreMatch && categoriaMatch && principioActivoMatch && numeroItemMatch;
    }).sort((a, b) => {
        const categoriaComparison = a.categoria.localeCompare(b.categoria);
        if (categoriaComparison !== 0) {
            return categoriaComparison;
        }
        return a.nombre.localeCompare(b.nombre);
    });
  }, [stockData, filters]);

  const totalStockValue = useMemo(() => filteredStockData.reduce((sum, item) => sum + item.valorStock, 0), [filteredStockData]);
  const itemsBajoMinimo = useMemo(() => filteredStockData.filter(item => item.stockFinal < item.stockMinimo).length, [filteredStockData]);
  
  const categoriasUnicas = useMemo(() => [...new Set(insumos.map(i => i.categoria))], [insumos]);

  const handleSaveInsumo = useCallback(async (insumoData: Omit<Insumo, 'id' | 'precioPromedioCalculado' | 'stockActual' | 'costoUnitario'>) => {
    if (!firestore) return;

    const dataToSave = {
      ...insumoData,
      principioActivo: insumoData.principioActivo || null,
      dosisRecomendada: insumoData.dosisRecomendada || null,
      proveedor: insumoData.proveedor || null,
    };
    
    if (selectedInsumo) {
      const insumoRef = doc(firestore, 'insumos', selectedInsumo.id);
      updateDocumentNonBlocking(insumoRef, dataToSave);
      toast({ title: "Insumo actualizado" });
    } else {
      const insumosCol = collection(firestore, 'insumos');
      const q = query(insumosCol, orderBy("numeroItem", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let maxNumeroItem = 0;
      if (!querySnapshot.empty) {
          maxNumeroItem = querySnapshot.docs[0].data().numeroItem || 0;
      }
      const numeroItem = maxNumeroItem + 1;

      addDocumentNonBlocking(insumosCol, { ...dataToSave, numeroItem, stockActual: 0, costoUnitario: 0, precioPromedioCalculado: 0 });
      toast({ title: "Insumo creado", description: `Item Nº ${numeroItem}` });
    }
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, [selectedInsumo, firestore, toast]);

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const insumo = insumos.find(i => i.id === id);
    const insumoRef = doc(firestore, "insumos", id);
    deleteDocumentNonBlocking(insumoRef);
    toast({
      variant: "destructive",
      title: "Insumo Eliminado",
      description: `El insumo "${insumo?.nombre}" ha sido eliminado.`,
    });
  };

  const handleDeleteAll = async () => {
    if (!firestore || insumos.length === 0) return;

    try {
        const insumosCollection = collection(firestore, 'insumos');
        const insumosSnapshot = await getDocs(insumosCollection);
        const batch = writeBatch(firestore);
        insumosSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        toast({
            variant: "destructive",
            title: "Todos los insumos eliminados",
            description: `Se han eliminado ${insumosSnapshot.size} registros de insumos.`,
        });
    } catch (error) {
        console.error("Error al eliminar todos los insumos: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudieron eliminar todos los insumos.",
        });
    } finally {
        setDeleteAllOpen(false);
        setDeleteConfirmationText("");
    }
  };


  const openDialog = useCallback((insumo?: Insumo) => {
    setSelectedInsumo(insumo || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, []);

  const exportToExcel = () => {
    const dataForExport = filteredStockData.map(item => ({
        'Item Nº': item.numeroItem,
        'Nombre': item.nombre,
        'Categoría': item.categoria,
        'Principio Activo': item.principioActivo || 'N/A',
        'Dosis Rec.': item.dosisRecomendada ? `${item.dosisRecomendada} ${item.unidad}/ha` : 'N/A',
        'Precio Prom. Calc. ($)': item.precioPromedioCalculado,
        'Unidad': item.unidad,
        'Entrada Total': item.entradaTotal,
        'Salida Total': item.salidaTotal,
        'Stock Actual': item.stockFinal,
        'Stock Mínimo': item.stockMinimo,
        'Valor en Stock ($)': item.valorStock,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock de Insumos");
    XLSX.writeFile(workbook, "StockInsumos.xlsx");
  };

  const exportToPDF = async () => {
    const input = document.getElementById('pdf-area');
    if (input) {
        const canvas = await html2canvas(input, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;
        const width = pdfWidth - 20; // Margen
        const height = width / ratio;
        
        pdf.addImage(imgData, 'PNG', 10, 10, width, height);
        pdf.save("StockInsumos.pdf");
    }
  };


  return (
    <>
      <PageHeader
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      >
        {user && (
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />Excel</Button>
                <Button variant="outline" onClick={exportToPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
                <ImportButton onClick={onImportClick} />
                <Button onClick={() => openDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo Insumo
                </Button>
                <AlertDialog onOpenChange={setDeleteAllOpen} open={isDeleteAllOpen}>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar todos los insumos?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción es irreversible y eliminará todos los registros de insumos. Para confirmar, escriba "ELIMINAR" en el campo de abajo.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <Input 
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder='Escriba ELIMINAR para confirmar'
                        />
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteConfirmationText("")}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAll}
                                disabled={deleteConfirmationText !== "ELIMINAR"}
                                className="bg-destructive hover:bg-destructive/90"
                            >
                                Eliminar Todo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        )}
      </PageHeader>
      
    <div id="pdf-area" className="print-area">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                  <CardTitle>Inventario Detallado</CardTitle>
                  <CardDescription>Análisis completo del movimiento de cada insumo.</CardDescription>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-xs text-muted-foreground">Valor Total del Stock</p>
                          <p className="text-lg font-bold">${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                  </div>
                   <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-xs text-muted-foreground">Items en Stock</p>
                          <p className="text-lg font-bold">{filteredStockData.length}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                          <p className="text-xs text-muted-foreground">Items con Stock Bajo</p>
                          <p className="text-lg font-bold text-destructive">{itemsBajoMinimo}</p>
                      </div>
                  </div>
              </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
            <Input 
              placeholder="Filtrar por Nº Item..."
              value={filters.numeroItem}
              onChange={(e) => handleFilterChange('numeroItem', e.target.value)}
            />
            <Input 
              placeholder="Filtrar por nombre..."
              value={filters.nombre}
              onChange={(e) => handleFilterChange('nombre', e.target.value)}
            />
            <Select value={filters.categoria} onValueChange={(v) => handleFilterChange('categoria', v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoría..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoriasUnicas.map(cat => (
                  <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input 
              placeholder="Filtrar por principio activo..."
              value={filters.principioActivo}
              onChange={(e) => handleFilterChange('principioActivo', e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Item Nº</TableHead>
                  <TableHead className="w-[250px] min-w-[250px]">Nombre</TableHead>
                  <TableHead className="w-[150px] min-w-[150px]">Categoría</TableHead>
                  <TableHead className="w-[150px] min-w-[150px]">Principio Activo</TableHead>
                  <TableHead className="w-[150px] min-w-[150px]">Dosis Rec.</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-right">Precio Prom. Calc.</TableHead>
                  <TableHead className="w-[100px]">Unidad</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-right">Entrada Total</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-right">Salida Total</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-right">Stock Actual</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-right">Stock Mínimo</TableHead>
                  <TableHead className="w-[180px] min-w-[180px] text-right">Valor en Stock</TableHead>
                  {user && <TableHead className="w-[100px] min-w-[100px] text-right no-print">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={13} className="text-center h-24">Cargando...</TableCell></TableRow>}
                {filteredStockData.map((insumo, index) => (
                  <TableRow key={insumo.id} className={insumo.stockFinal < insumo.stockMinimo ? "bg-destructive/10" : ""}>
                    <TableCell className="font-medium text-muted-foreground py-2 px-4">{insumo.numeroItem || index + 1}</TableCell>
                    <TableCell className="font-medium py-2 px-4">
                       <div className="flex items-center gap-2">
                          {insumo.stockFinal < insumo.stockMinimo && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Stock por debajo del mínimo</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {insumo.nombre}
                       </div>
                    </TableCell>
                    <TableCell className="py-2 px-4">
                      <Badge variant="secondary" className="capitalize">{insumo.categoria}</Badge>
                    </TableCell>
                    <TableCell className="py-2 px-4">{insumo.principioActivo || 'N/A'}</TableCell>
                    <TableCell className="py-2 px-4">{insumo.dosisRecomendada ? `${insumo.dosisRecomendada} ${insumo.unidad}/ha` : 'N/A'}</TableCell>
                    <TableCell className="text-right font-mono py-2 px-4">${insumo.precioPromedioCalculado.toFixed(2)}</TableCell>
                    <TableCell className="py-2 px-4">{insumo.unidad}</TableCell>
                    <TableCell className="text-right font-mono text-green-600 py-2 px-4">
                      <div className="flex items-center justify-end gap-1"><ArrowUp size={14}/> {insumo.entradaTotal.toLocaleString('en-US')}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600 py-2 px-4">
                      <div className="flex items-center justify-end gap-1"><ArrowDown size={14}/> {insumo.salidaTotal.toLocaleString('en-US')}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold py-2 px-4">{insumo.stockFinal.toLocaleString('en-US')}</TableCell>
                    <TableCell className="text-right font-mono py-2 px-4">{insumo.stockMinimo.toLocaleString('en-US')}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary py-2 px-4">${insumo.valorStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    
                    {user && (
                      <TableCell className="text-right py-2 px-4 no-print">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(insumo)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Ver Movimientos
                            </DropdownMenuItem>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive"
                                  >
                                    Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      ¿Está seguro que desea eliminar este insumo?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Esto
                                      eliminará permanentemente el insumo.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(insumo.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!isLoading && filteredStockData.length === 0 && (
                  <TableRow><TableCell colSpan={13} className="text-center h-24">No se encontraron insumos para los filtros aplicados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedInsumo ? 'Editar Insumo' : 'Crear Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <InsumoForm 
            insumo={selectedInsumo}
            onSubmit={handleSaveInsumo}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
