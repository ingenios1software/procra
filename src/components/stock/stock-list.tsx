"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, AlertCircle, Package, DollarSign, Trash2, Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Insumo, CompraNormal, LoteInsumo } from "@/lib/types";
import { useUser, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { InsumoForm } from "./insumo-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "../shared/page-header";
import { ReportActions } from "../shared/report-actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { doc, getDocs, query, orderBy, limit, writeBatch } from "firebase/firestore";
import { ImportButton } from "./import-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { calcularPrecioPromedioDesdeCompras, toPositiveNumber } from "@/lib/stock/precio-promedio-lotes";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

interface StockListProps {
  insumos: Insumo[];
  lotes: LoteInsumo[];
  comprasNormal: CompraNormal[];
  isLoading: boolean;
  onImportClick: () => void;
}

export function StockList({ insumos, lotes, comprasNormal, isLoading, onImportClick }: StockListProps) {
  const { user } = useUser();
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
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
    soloEnStock: false,
  });

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const stockData = useMemo(() => {
    if (!insumos) return [];

    return insumos.map(insumo => {
        const precioDesdeCompras = calcularPrecioPromedioDesdeCompras(insumo.id, comprasNormal);
        const precioPromedio =
          precioDesdeCompras !== null
            ? precioDesdeCompras
            : toPositiveNumber(insumo.precioPromedioCalculado || insumo.costoUnitario || 0);
        const stockFinal = insumo.stockActual || 0;
        const valorStock = stockFinal * precioPromedio;

        return {
            ...insumo,
            stockFinal: stockFinal,
            precioPromedioCalculado: precioPromedio,
            valorStock,
        };
    });
  }, [insumos, comprasNormal]);
  
  const filteredStockData = useMemo(() => {
    return stockData.filter(insumo => {
      const nombreMatch = insumo.nombre.toLowerCase().includes(filters.nombre.toLowerCase());
      const categoriaMatch = filters.categoria
        ? insumo.categoria.toLowerCase().includes(filters.categoria.toLowerCase())
        : true;
      const principioActivoMatch = insumo.principioActivo ? insumo.principioActivo.toLowerCase().includes(filters.principioActivo.toLowerCase()) : true;
      const numeroItemMatch = filters.numeroItem ? insumo.numeroItem?.toString().includes(filters.numeroItem) : true;
      const stockMatch = filters.soloEnStock ? insumo.stockFinal > 0 : true;
      
      if (filters.principioActivo && !insumo.principioActivo) return false;

      return nombreMatch && categoriaMatch && principioActivoMatch && numeroItemMatch && stockMatch;
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
  const shareSummary = `Items: ${filteredStockData.length} | Valor stock: $${totalStockValue.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} | Bajo minimo: ${itemsBajoMinimo}.`;
  
  const categoriasUnicas = useMemo(
    () =>
      [...new Set(insumos.map((i) => (i.categoria || "").trim().toLowerCase()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [insumos]
  );

  const alertasVencimiento = useMemo(() => {
    const hoy = new Date();
    return lotes
      .map((lote) => {
        if (!lote.fechaVencimiento) return null;
        const fechaVencimiento = new Date(lote.fechaVencimiento as string);
        if (Number.isNaN(fechaVencimiento.getTime())) return null;
        const insumo = insumos.find(i => i.id === lote.insumoId);
        if (!insumo) return null;
        const diasAlerta = insumo.diasAlertaVencimiento || 30;
        const diffDias = Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > diasAlerta) return null;
        return { lote, insumo, diffDias, vencido: diffDias < 0 };
      })
      .filter((x): x is { lote: LoteInsumo; insumo: Insumo; diffDias: number; vencido: boolean } => Boolean(x))
      .sort((a, b) => a.diffDias - b.diffDias);
  }, [lotes, insumos]);

  const handleSaveInsumo = useCallback(async (insumoData: Omit<Insumo, 'id' | 'precioPromedioCalculado' | 'stockActual' | 'costoUnitario'>) => {
    const insumosCol = tenant.collection('insumos');
    if (!firestore || !insumosCol) return;

    const dataToSave = {
      ...insumoData,
      principioActivo: insumoData.principioActivo || null,
      dosisRecomendada: insumoData.dosisRecomendada || null,
      proveedor: insumoData.proveedor || null,
    };
    
    if (selectedInsumo) {
      const insumoRef = tenant.doc('insumos', selectedInsumo.id);
      if (!insumoRef) return;
      updateDocumentNonBlocking(insumoRef, dataToSave);
      toast({ title: "Insumo actualizado" });
    } else {
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
    const insumoRef = tenant.doc("insumos", id);
    if (!insumoRef) return;
    deleteDocumentNonBlocking(insumoRef);
    toast({
      variant: "destructive",
      title: "Insumo Eliminado",
      description: `El insumo "${insumo?.nombre}" ha sido eliminado.`,
    });
  };

  const handleDeleteAll = async () => {
    const insumosCollection = tenant.collection('insumos');
    if (!firestore || !insumosCollection || insumos.length === 0) return;

    try {
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
        'Stock Actual': item.stockFinal,
        'Precio Promedio ($)': item.precioPromedioCalculado,
        'Valor en Stock ($)': item.valorStock,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock de Insumos");
    XLSX.writeFile(workbook, "StockInsumos.xlsx");
  };

  return (
    <>
      <PageHeader
        title="Control de Insumos y Stock"
        description="Gestione el inventario de fertilizantes, semillas y otros insumos agrícolas."
      >
        {user && (
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />Excel</Button>
                <ReportActions
                  reportTitle="Control de Insumos y Stock"
                  reportSummary={shareSummary}
                  imageTargetId="stock-print-area"
                  printTargetId="stock-print-area"
                  documentLabel="Reporte de Stock"
                />
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
                                Esta acción es irreversible y eliminará todos los registros de insumos. Para confirmar, escriba &quot;ELIMINAR&quot; en el campo de abajo.
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

      {alertasVencimiento.length > 0 && (
        <Card className="mb-4 border-amber-300">
          <CardHeader>
            <CardTitle>Alertas de vencimiento de lotes</CardTitle>
            <CardDescription>Lotes próximos a vencer o vencidos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertasVencimiento.slice(0, 8).map(({ lote, insumo, diffDias, vencido }) => (
              <div key={lote.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span>{insumo.nombre} · Lote {lote.codigoLote}</span>
                <Badge variant={vencido ? 'destructive' : 'secondary'}>{vencido ? `Vencido hace ${Math.abs(diffDias)} días` : `Vence en ${diffDias} días`}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
    <div id="stock-print-area" className="print-area">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="flex-grow">
                  <CardTitle>Inventario Detallado</CardTitle>
                  <CardDescription>Análisis completo del movimiento de cada insumo.</CardDescription>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="text-xs text-muted-foreground">Valor Total del Stock</p>
                          <p className="text-lg font-bold">${totalStockValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5 no-print">
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
            <Input
              list="stock-categorias"
              placeholder="Filtrar por categoría (escriba)..."
              value={filters.categoria}
              onChange={(e) => handleFilterChange('categoria', e.target.value.toLowerCase())}
            />
            <datalist id="stock-categorias">
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <Input 
              placeholder="Filtrar por principio activo..."
              value={filters.principioActivo}
              onChange={(e) => handleFilterChange('principioActivo', e.target.value)}
            />
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm text-muted-foreground">Solo en stock</span>
              <Switch
                checked={filters.soloEnStock}
                onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, soloEnStock: checked }))}
                aria-label="Filtrar solo insumos con stock mayor a cero"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>Item Nº</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Principio Activo</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Precio Promedio</TableHead>
                  <TableHead className="text-right">Valor en Stock</TableHead>
                  {user && <TableHead className="text-right no-print">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center h-24">Cargando...</TableCell></TableRow>}
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
                                  <p>Stock por debajo del mínimo ({insumo.stockMinimo} {insumo.unidad})</p>
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
                    <TableCell className="text-right font-mono font-bold py-2 px-4">{insumo.stockFinal.toLocaleString('de-DE')} {insumo.unidad}</TableCell>
                    <TableCell className="text-right font-mono py-2 px-4">${insumo.precioPromedioCalculado.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary py-2 px-4">${insumo.valorStock.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    
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
                            <DropdownMenuItem asChild>
                                <Link href={`/stock/insumos/${insumo.id}`}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver Ficha
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog(insumo)}>
                              Editar
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
                  <TableRow><TableCell colSpan={8} className="text-center h-24">No se encontraron insumos para los filtros aplicados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
      
      <Dialog modal={false} open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent draggable className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedInsumo ? 'Editar Insumo' : 'Crear Nuevo Insumo'}</DialogTitle>
          </DialogHeader>
          <InsumoForm 
            insumo={selectedInsumo}
            existingCategories={categoriasUnicas}
            onSubmit={handleSaveInsumo}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

