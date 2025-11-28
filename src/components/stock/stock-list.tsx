
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
import { useAuth } from "@/hooks/use-auth";
import { InsumoForm } from "./insumo-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mockEventos, mockCompras } from "@/lib/mock-data";
import { PageHeader } from "../shared/page-header";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";


interface StockListProps {
  initialInsumos: Insumo[];
}

export function StockList({ initialInsumos }: StockListProps) {
  const [insumos, setInsumos] = useState(initialInsumos);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === 'admin' || role === 'operador' || role === 'gerente';
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
    // 1. Unificar y ordenar cronológicamente todos los movimientos (entradas y salidas)
    const allEvents: (
      { type: 'entrada'; fecha: Date; insumoId: string; cantidad: number; costo: number; } |
      { type: 'salida'; fecha: Date; insumoId: string; cantidad: number; }
    )[] = [];

    // Añadir stock inicial como la primera entrada para cada insumo
    insumos.forEach(insumo => {
        if (insumo.stockActual > 0) {
            // Usamos una fecha muy antigua para asegurar que sea el primer evento
            allEvents.push({ type: 'entrada', fecha: new Date('2000-01-01'), insumoId: insumo.id, cantidad: insumo.stockActual, costo: insumo.costoUnitario });
        }
    });

    // Añadir compras
    mockCompras.forEach(compra => {
        compra.items.forEach(item => {
            allEvents.push({ type: 'entrada', fecha: new Date(compra.fecha), insumoId: item.insumoId, cantidad: item.cantidad, costo: item.precioUnitario });
        });
    });

    // Añadir salidas de eventos
    mockEventos.forEach(evento => {
        evento.productos?.forEach(prod => {
            allEvents.push({ type: 'salida', fecha: new Date(evento.fecha), insumoId: prod.insumoId, cantidad: prod.cantidad });
        });
    });
    
    // Ordenar todos los movimientos por fecha
    allEvents.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    // 2. Procesar movimientos para cada insumo
    const calculatedInsumos = insumos.map(insumo => {
        let currentStock = 0;
        let totalValue = 0;
        let entradaTotal = 0;
        let salidaTotal = 0;

        // Filtrar movimientos para el insumo actual
        const insumoMovements = allEvents.filter(e => e.insumoId === insumo.id);
        
        insumoMovements.forEach(mov => {
            if (mov.type === 'entrada') {
                // Si el stock es cero, el nuevo promedio es simplemente el costo de esta entrada
                if (currentStock === 0) {
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

                // El valor del inventario disminuye en proporción al costo promedio
                if (stockAntesSalida > 0) {
                    const avgCost = totalValue / stockAntesSalida;
                    totalValue -= mov.cantidad * avgCost;
                }

                // Congelar y reiniciar si el stock llega a cero
                if (currentStock <= 0) {
                    totalValue = 0;
                    currentStock = 0; // Asegurarse de que no sea negativo
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
  }, [insumos]);
  
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
  
  const categoriasUnicas = [...new Set(insumos.map(i => i.categoria))];

  const handleSaveInsumo = useCallback((insumoData: Insumo) => {
    if (selectedInsumo) {
      setInsumos(prev => prev.map(i => i.id === insumoData.id ? insumoData : i));
    } else {
      setInsumos(prev => [...prev, { ...insumoData, id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }]);
    }
    setDialogOpen(false);
    setSelectedInsumo(null);
  }, [selectedInsumo]);

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

        const nuevosInsumos: Insumo[] = json.map((row, index) => ({
          id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          nombre: getColumnValue(row, 'NOMBRE') || 'Sin Nombre',
          categoria: getColumnValue(row, 'CATEGORIA') || 'otros',
          unidad: getColumnValue(row, 'Unid') || 'unidad',
          costoUnitario: Number(getColumnValue(row, 'Precio Promedio')) || 0,
          stockActual: Number(getColumnValue(row, 'stockActual')) || 0,
          stockMinimo: Number(getColumnValue(row, 'stockMinimo')) || 0,
          principioActivo: getColumnValue(row, 'Principio Activo'),
          dosisRecomendada: Number(getColumnValue(row, 'Dosis Rec.')) || undefined,
          proveedor: getColumnValue(row, 'proveedor'),
        }));

        setInsumos(prev => [...prev, ...nuevosInsumos]);
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
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      >
        {canModify && (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total del Stock</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalStockValue.toLocaleString('en-US')}</div>
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
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
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
                  <TableCell className="text-right font-mono text-green-600 flex items-center justify-end gap-1"><ArrowUp size={14}/> {insumo.entradaTotal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono text-red-600 flex items-center justify-end gap-1"><ArrowDown size={14}/> {insumo.salidaTotal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{insumo.stockFinal.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono">{insumo.stockMinimo.toLocaleString()} {insumo.unidad}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-primary">${insumo.valorStock.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                  
                  {canModify && (
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
