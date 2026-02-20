"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CompraNormal, Proveedor, AsientoDiario, PlanDeCuenta } from "@/lib/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CompraNormalForm } from "@/components/comercial/compras/compra-normal-form";
import { MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, writeBatch, doc } from 'firebase/firestore';


export default function ComprasPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<CompraNormal | null>(null);
  const [compraParaAprobar, setCompraParaAprobar] = useState<CompraNormal | null>(null);
  const [cuentaPagoAprobacionId, setCuentaPagoAprobacionId] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();

  const comprasQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'comprasNormal'), orderBy('fechaEmision', 'desc')) : null
  , [firestore]);
  const { data: compras, isLoading: isLoadingCompras } = useCollection<CompraNormal>(comprasQuery);

  const proveedoresQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'proveedores')) : null
  , [firestore]);
  const { data: proveedores, isLoading: isLoadingProveedores } = useCollection<Proveedor>(proveedoresQuery);
  const planDeCuentasQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'planDeCuentas'), orderBy('codigo')) : null
  , [firestore]);
  const { data: planDeCuentas } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const getProveedorNombre = (id: string) => {
    if (!proveedores) return 'N/A';
    return proveedores.find(p => p.id === id)?.nombre || 'N/A';
  }


  const cuentasPago = useMemo(() => {
    return (planDeCuentas || []).filter(c => c.tipo === 'activo');
  }, [planDeCuentas]);

  const handleOpenApprove = (compra: CompraNormal) => {
    setCompraParaAprobar(compra);
    setCuentaPagoAprobacionId("");
  };

  const handleApproveCompra = async () => {
    if (!firestore || !compraParaAprobar || !user) return;
    if (!compraParaAprobar.financiero?.cuentaPorPagarId) {
      toast({ variant: 'destructive', title: 'Falta cuenta por pagar', description: 'Edite la compra y seleccione cuenta por pagar.' });
      return;
    }

    setIsApproving(true);
    try {
      const batch = writeBatch(firestore);
      const compraRef = doc(firestore, 'comprasNormal', compraParaAprobar.id);
      const pagoAplicado = Boolean(cuentaPagoAprobacionId);
      let asientoPagoId: string | undefined;

      if (pagoAplicado) {
        const asientoPagoRef = doc(collection(firestore, 'asientosDiario'));
        const asientoPago: Omit<AsientoDiario, 'id'> = {
          fecha: new Date().toISOString(),
          descripcion: `Pago compra ${compraParaAprobar.comprobante.documento}`,
          movimientos: [
            { cuentaId: compraParaAprobar.financiero.cuentaPorPagarId, tipo: 'debe', monto: compraParaAprobar.totalFactura },
            { cuentaId: cuentaPagoAprobacionId, tipo: 'haber', monto: compraParaAprobar.totalFactura },
          ],
        };
        batch.set(asientoPagoRef, asientoPago);
        asientoPagoId = asientoPagoRef.id;
      }

      batch.update(compraRef, {
        estado: 'cerrado',
        'financiero.pagoAplicado': pagoAplicado,
        'financiero.cuentaPagoId': pagoAplicado ? cuentaPagoAprobacionId : null,
        'financiero.asientoPagoId': asientoPagoId || null,
        'financiero.fechaPago': pagoAplicado ? new Date().toISOString() : null,
      });

      await batch.commit();
      toast({ title: pagoAplicado ? 'Compra aprobada y pagada' : 'Compra aprobada sin pago' });
      setCompraParaAprobar(null);
      setCuentaPagoAprobacionId('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'No se pudo aprobar', description: error?.message || 'Error inesperado' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const openForm = (compra?: CompraNormal) => {
    setSelectedCompra(compra || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedCompra(null);
  }

  return (
    <>
      <PageHeader
        title="Consulta de Facturas de Compra"
        description="Consulte, edite y registre las compras de insumos, productos y servicios."
      >
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
            </Button>
            {user && (
              <Button onClick={() => openForm()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Compra
              </Button>
            )}
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Facturas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Entidad (Proveedor)</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoadingCompras || isLoadingProveedores) && <TableRow><TableCell colSpan={9} className="text-center">Cargando...</TableCell></TableRow>}
              {compras?.map((compra) => (
                <TableRow key={compra.id}>
                  <TableCell>{compra.codigo}</TableCell>
                  <TableCell>{format(new Date(compra.fechaEmision as string), "dd/MM/yyyy")}</TableCell>
                  <TableCell>{compra.comprobante.documento}</TableCell>
                  <TableCell>{getProveedorNombre(compra.entidadId)}</TableCell>
                  <TableCell className="text-right font-mono">${compra.totalFactura.toLocaleString('en-US')}</TableCell>
                   <TableCell>{compra.moneda}</TableCell>
                  <TableCell>{compra.usuario}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-green-600 text-white": compra.estado === 'cerrado',
                        "bg-yellow-500 text-black": compra.estado === 'abierto',
                         "bg-red-600 text-white": compra.estado === 'anulado',
                      })}
                    >
                      {compra.estado}
                    </Badge>
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => openForm(compra)}>Ver Detalle</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openForm(compra)}>Editar</DropdownMenuItem>
                        {compra.estado === "abierto" && <DropdownMenuItem onClick={() => handleOpenApprove(compra)}>Aprobar</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive">Anular</DropdownMenuItem>
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
        <DialogContent className="max-w-6xl h-screen md:h-auto">
           <DialogHeader>
             <DialogTitle>{selectedCompra ? `Editar Compra N° ${selectedCompra.codigo}`: 'Registrar Nueva Compra Normal'}</DialogTitle>
             <DialogDescription>
                Complete los detalles de la factura o documento de compra.
             </DialogDescription>
           </DialogHeader>
            <div className="overflow-y-auto max-h-[85vh]">
              <CompraNormalForm compra={selectedCompra} onCancel={closeForm} />
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(compraParaAprobar)} onOpenChange={(open) => !open && setCompraParaAprobar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar compra</DialogTitle>
            <DialogDescription>
              Puede cerrar la compra solo como crédito, o aplicar pago inmediato desde una cuenta (caja/banco).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Comprobante</p>
              <p className="font-medium">{compraParaAprobar?.comprobante?.documento}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-medium">{compraParaAprobar?.totalFactura?.toLocaleString('en-US')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cuenta de pago contable (opcional)</label>
              <Select value={cuentaPagoAprobacionId} onValueChange={setCuentaPagoAprobacionId}>
                <SelectTrigger><SelectValue placeholder="Aprobar sin pago inmediato" /></SelectTrigger>
                <SelectContent>
                  {cuentasPago.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompraParaAprobar(null)}>Cancelar</Button>
            <Button onClick={handleApproveCompra} disabled={isApproving}>{isApproving ? 'Aprobando...' : 'Confirmar aprobación'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
