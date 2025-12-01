"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, AlertCircle, Package, DollarSign, ArrowDown, ArrowUp, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insumo, Compra, Evento } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { InsumoForm } from "./insumo-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "../shared/page-header";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { collection, doc } from "firebase/firestore";

interface StockListProps {
  insumos: Insumo[];
  compras: Compra[];
  eventos: Evento[];
  isLoading: boolean;
}

export function StockList({ insumos, compras, eventos, isLoading }: StockListProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    nombre: '',
    categoria: '',
    principioActivo: ''
  });

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const stockData = useMemo(() => {
    if (!insumos || !compras || !eventos) return [];
    
    const allEvents: (
      { type: 'entrada'; fecha: Date; insumoId: string; cantidad: number; costo: number; } |
      { type: 'salida'; fecha: Date; insumoId: string; cantidad: number; }
    )[] = [];

    insumos.forEach(insumo => {
        if (insumo.stockActual > 0) {
            allEvents.push({ type: 'entrada', fecha: new Date('2000-01-01'), insumoId: insumo.id, cantidad: insumo.stockActual, costo: insumo.costoUnitario });
        }
    });

    compras.forEach(compra => {
        compra.items.forEach(item => {
            allEvents.push({ type: 'entrada', fecha: new Date(compra.fecha as string), insumoId: item.insumoId, cantidad: item.cantidad, costo: item.precioUnitario });
        });
    });

    eventos.forEach(evento => {
        evento.productos?.forEach(prod => {
            allEvents.push({ type: 'salida', fecha: new Date(evento.fecha as string), insumoId: prod.insumoId, cantidad: prod.cantidad });
        });
    });
    
    allEvents.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const calculatedInsumos = insumos.map(insumo => {
        let currentStock = 0;
        let totalValue = 0;
        let entradaTotal = 0;
        let salidaTotal = 0;

        const insumoMovements = allEvents.filter(e => e.insumoId === insumo.id);
        
        insumoMovements.forEach(mov => {
            if (mov.type === 'entrada') {
                if (currentStock <= 0) {
                    totalValue = mov.cantidad * mov.costo;
                } else {
                    totalValue += mov.cantidad * mov.costo;
                }
                currentStock += mov.cantidad;
                entradaTotal += mov.cantidad;
            } else if (mov.type === 'salida') {
                const stockAntesSalida = currentStock;
                currentStock -= mov.cantidad;
                salidaTotal += mov.cantidad;

                if (stockAntesSalida > 0) {
                    const avgCost = totalValue / stockAntesSalida;
                    totalValue -= mov.cantidad * avgCost;
                }

                if (currentStock <= 0) {
                    totalValue = 0;
                    currentStock = 0;
                }
            }
        });
        
        const precioPromedioPonderado = currentStock > 0 ? totalValue / currentStock : 0;
        const valorStock = totalValue;

        return {
            ...insumo,
            entradaTotal,
            salidaTotal,
            stockFinal: currentStock,
            precioPromedioPonderado: precioPromedioPonderado,
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
      
      if (filters.principioActivo && !insumo.principioActivo) return false;

      return nombreMatch && categoriaMatch && principioActivoMatch;
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

  const handleSaveInsumo = useCallback((insumoData: Omit<Insumo, 'id'>) => {
    if (!firestore) return;
    
    if (selectedInsumo) {
      const insumoRef = doc(firestore, 'insumos', selectedInsumo.id);
      updateDocumentNonBlocking(insumoRef, insumoData);
      toast({ title: "Insumo actualizado" });
    } else {
      const insumosCol = collection(firestore, 'insumos');
      addDocumentNonBlocking(insumosCol, insumoData);
      toast({ title: "Insumo creado" });
    }
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, [selectedInsumo, firestore, toast]);

  const openDialog = useCallback((insumo?: Insumo) => {
    setSelectedInsumo(insumo || null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, []);
  
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

        const nuevosInsumos: Omit<Insumo, 'id'>[] = json.map((row) => ({
          nombre: row['NOMBRE'] || 'Sin Nombre',
          categoria: row['CATEGORIA'] || 'otros',
          unidad: row['Unid'] || 'unidad',
          costoUnitario: Number(row['Precio Promedio']) || 0,
          stockActual: Number(row['stockActual']) || 0,
          stockMinimo: Number(row['stockMinimo']) || 0,
          principioActivo: row['Principio Activo'],
          dosisRecomendada: Number(row['Dosis Rec.']) || undefined,
          proveedor: row['proveedor'],
        }));
        
        const insumosCol = collection(firestore, 'insumos');
        nuevosInsumos.forEach(insumo => addDocumentNonBlocking(insumosCol, insumo));

        toast({
          title: "Importación exitosa",
          description: `${nuevosInsumos.length} insumos han sido agregados.`,
        });

      } catch (error) {
        console.error("Error al importar el archivo:", error);
        toast({
          variant: "destructive",
          title: "Error de importación",
          description: "No se pudo leer el archivo. Asegúrese de que sea un formato válido.",
        });
      } finally {
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <PageHeader
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      >
        {user && (
            <div className="flex items-center gap-2">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                />
                <Button variant="outline" onClick={handleImportClick}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Excel
                </Button>
                <Button onClick={() => openDialog()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo Insumo
                </Button>
            </div>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total del Stock</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Valor estimado del inventario actual</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items en Stock</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredStockData.length}</div>
                <p className="text-xs text-muted-foreground">Total de insumos únicos</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Items con Stock Bajo</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{itemsBajoMinimo}</div>
                <p className="text-xs text-muted-foreground">Insumos por debajo del stock mínimo</p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Inventario Detallado</CardTitle>
            <CardDescription>Análisis completo del movimiento de cada insumo.</CardDescription>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              placeholder="Filtrar por nombre..."
              value={filters.nombre}
              onChange={(e) => handleFilterChange('nombre', e.target.value)}
            />
            <Input 
              placeholder="Filtrar por principio activo..."
              value={filters.principioActivo}
              onChange={(e) => handleFilterChange('principioActivo', e.target.value)}
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
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Principio Activo</TableHead>
                <TableHead>Dosis Rec.</TableHead>
                <TableHead className="text-right">Precio Promedio Ponderado</TableHead>
                <TableHead className="text-right">Entrada Total</TableHead>
                <TableHead className="text-right">Salida Total</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mínimo</TableHead>
                <TableHead className="text-right">Valor en Stock</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={10} className="text-center">Cargando...</TableCell></TableRow>}
              {filteredStockData.map((insumo) => (
                <TableRow key={insumo.id} className={insumo.stockFinal < insumo.stockMinimo ? "bg-destructive/10" : ""}>
                  <TableCell className="font-medium">
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
                     <Badge variant="secondary" className="capitalize mt-1">{insumo.categoria}</Badge>
                  </TableCell>
                  <TableCell>{insumo.principioActivo || 'N/A'}</TableCell>
                  <TableCell>{insumo.dosisRecomendada ? `${insumo.dosisRecomendada} ${insumo.unidad}/ha` : 'N/A'}</TableCell>
                  <TableCell className="text-right font-mono">${insumo.precioPromedioPonderado.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600 flex items-center justify-end gap-1"><ArrowUp size={14}/> {insumo.entradaTotal.toLocaleString('en-US')} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono text-red-600 flex items-center justify-end gap-1"><ArrowDown size={14}/> {insumo.salidaTotal.toLocaleString('en-US')} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{insumo.stockFinal.toLocaleString('en-US')} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono">{insumo.stockMinimo.toLocaleString('en-US')} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">${insumo.valorStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  
                  {user && (
                    <TableCell className="text-right">
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
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
