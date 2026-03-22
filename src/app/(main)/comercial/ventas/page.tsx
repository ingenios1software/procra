"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { doc, orderBy, query, where, writeBatch } from "firebase/firestore";
import { Loader2, MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useMemoFirebase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { resolveZafraContext, withZafraContext } from "@/lib/contabilidad/asientos";
import { CODIGOS_CUENTAS_BASE, findPlanCuentaByCodigo, getCuentasBaseFaltantes } from "@/lib/contabilidad/cuentas-base";
import { calcularEstadoCuenta } from "@/lib/cuentas";
import { formatCurrency } from "@/lib/utils";
import { VentaForm } from "@/components/comercial/ventas/venta-form";
import type {
  AsientoDiario,
  Cliente,
  CuentaCajaBanco,
  CuentaPorCobrar,
  Cultivo,
  Deposito,
  Insumo,
  MovimientoStock,
  PlanDeCuenta,
  Venta,
  Zafra,
} from "@/lib/types";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const DEMO_IDS = {
  venta: "demo-venta-inicial",
  cliente: "demo-cliente-primera-venta",
  deposito: "demo-deposito-principal",
  cultivo: "demo-cultivo-soja",
  zafra: "demo-zafra-2025-2026",
  insumo: "demo-producto-comercial",
  asientoVenta: "demo-asiento-venta-inicial",
  asientoCmv: "demo-asiento-cmv-inicial",
  movimientoStock: "demo-movimiento-stock-venta-inicial",
} as const;

const DEMO_NUMERO_DOCUMENTO = "VTA-DEMO-0001";
const FORMA_PAGO_CREDITO = "Cr\u00c3\u00a9dito" as Venta["formaPago"];

function normalizeAccountCode(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

export default function VentasPage() {
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { user } = useUser();
  const { toast } = useToast();
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [isSimulatingFirstSale, setSimulatingFirstSale] = useState(false);

  const { data: ventas, isLoading: isLoadingVentas } = useCollection<Venta>(
    useMemoFirebase(
      () => tenant.query("ventas", orderBy("fecha", "desc")),
      [tenant]
    )
  );
  const { data: clientes, isLoading: isLoadingClientes } = useCollection<Cliente>(
    useMemoFirebase(() => tenant.query("clientes"), [tenant])
  );
  const { data: depositos, isLoading: isLoadingDepositos } = useCollection<Deposito>(
    useMemoFirebase(() => tenant.query("depositos"), [tenant])
  );
  const { data: cuentasCajaBanco } = useCollection<CuentaCajaBanco>(
    useMemoFirebase(
      () => tenant.query("cuentasCajaBanco", where("activo", "==", true)),
      [tenant]
    )
  );
  const { data: zafras, isLoading: isLoadingZafras } = useCollection<Zafra>(
    useMemoFirebase(() => tenant.query("zafras"), [tenant])
  );
  const { data: cultivos, isLoading: isLoadingCultivos } = useCollection<Cultivo>(
    useMemoFirebase(() => tenant.query("cultivos"), [tenant])
  );
  const { data: planDeCuentas, isLoading: isLoadingPlanDeCuentas } = useCollection<PlanDeCuenta>(
    useMemoFirebase(
      () => tenant.query("planDeCuentas", orderBy("codigo")),
      [tenant]
    )
  );

  const getClienteNombre = (id: string) => clientes?.find((cliente) => cliente.id === id)?.nombre || "N/A";

  const openForm = (venta?: Venta) => {
    setSelectedVenta(venta || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedVenta(null);
  };

  const totalVentas = useMemo(
    () => (ventas || []).reduce((sum, venta) => sum + (venta.total || 0), 0),
    [ventas]
  );
  const shareSummary = `Ventas: ${ventas?.length || 0} | Total: $${formatCurrency(totalVentas)}.`;
  const shouldShowSimulation = Boolean(user) && !isLoadingVentas && (ventas?.length ?? 0) === 0;

  const handleSimularPrimeraVenta = async () => {
    if (!firestore || !user || isSimulatingFirstSale || !tenant.isReady) return;
    if (isLoadingPlanDeCuentas) {
      toast({
        title: "Espere un momento",
        description: "Todavia se esta cargando el plan de cuentas.",
      });
      return;
    }

    const ventaExistente = (ventas || []).find(
      (venta) => venta.id === DEMO_IDS.venta || venta.numeroDocumento === DEMO_NUMERO_DOCUMENTO
    );
    if (ventaExistente) {
      toast({
        title: "La venta demo ya existe",
        description: "Ya hay una primera venta de ejemplo cargada en el sistema.",
      });
      return;
    }

    setSimulatingFirstSale(true);
    try {
      const now = new Date();
      const vencimiento = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
      const cantidadDemo = 10;
      const precioVentaDemo = 110000;
      const costoPromedioDemo = 80000;
      const stockAntesDemo = 50;
      const stockDespuesDemo = stockAntesDemo - cantidadDemo;
      const subtotalDemo = cantidadDemo * precioVentaDemo;
      const iva10Demo = subtotalDemo - subtotalDemo / 1.1;
      const baseImponibleDemo = subtotalDemo - iva10Demo;
      const costoTotalCmvDemo = cantidadDemo * costoPromedioDemo;
      const descripcionDemo = "Venta demo creada desde la pantalla de ventas.";

      const batch = writeBatch(firestore);
      const cuentasActuales = planDeCuentas || [];
      const cuentasPorCodigo = new Map<string, string>();

      for (const cuenta of cuentasActuales) {
        cuentasPorCodigo.set(normalizeAccountCode(cuenta.codigo), cuenta.id);
      }

      for (const cuentaFaltante of getCuentasBaseFaltantes(cuentasActuales)) {
        const planCol = tenant.collection("planDeCuentas");
        if (!planCol) throw new Error("No se pudo resolver el plan de cuentas de la empresa.");
        const cuentaRef = doc(planCol);
        batch.set(cuentaRef, cuentaFaltante);
        cuentasPorCodigo.set(normalizeAccountCode(cuentaFaltante.codigo), cuentaRef.id);
      }

      const resolveCuentaId = (codigo: string) =>
        findPlanCuentaByCodigo(cuentasActuales, codigo)?.id || cuentasPorCodigo.get(normalizeAccountCode(codigo));

      const cuentaClientesId = resolveCuentaId(CODIGOS_CUENTAS_BASE.CLIENTES);
      const cuentaVentasId = resolveCuentaId(CODIGOS_CUENTAS_BASE.VENTAS);
      const cuentaIvaDebitoId = resolveCuentaId(CODIGOS_CUENTAS_BASE.IVA_DEBITO);
      const cuentaCmvId = resolveCuentaId(CODIGOS_CUENTAS_BASE.CMV);
      const cuentaInventarioId = resolveCuentaId(CODIGOS_CUENTAS_BASE.INVENTARIO);

      if (!cuentaClientesId || !cuentaVentasId || !cuentaIvaDebitoId || !cuentaCmvId || !cuentaInventarioId) {
        throw new Error("No se pudieron resolver las cuentas contables base para la venta demo.");
      }

      const clienteDemo: Omit<Cliente, "id"> = {
        nombre: "Cliente de Ejemplo",
        ruc: "80000001-2",
        direccion: "Ruta PY Demo, Asuncion",
        telefono: "0981 000000",
        email: "cliente.demo@procra.local",
        ciudad: "Asuncion",
        pais: "Paraguay",
        tipoCliente: "interno",
        activo: true,
        observaciones: "Cliente generado para la primera venta del sistema.",
        fechaRegistro: now,
        creadoPor: user.uid,
      };

      const depositoDemo: Omit<Deposito, "id"> = {
        nombre: "Deposito Principal Demo",
        descripcion: "Deposito base para la primera venta simulada.",
        activo: true,
      };

      const cultivoDemo: Omit<Cultivo, "id"> = {
        nombre: "Soja Demo",
        descripcion: "Cultivo de ejemplo para ventas iniciales.",
      };

      const zafraDemo: Omit<Zafra, "id"> = {
        nombre: "Zafra Demo 2025-2026",
        fechaInicio: "2025-07-01T00:00:00.000Z",
        fechaFin: "2026-06-30T00:00:00.000Z",
        estado: "en curso",
        cultivoId: DEMO_IDS.cultivo,
        fechaSiembra: "2025-09-15T00:00:00.000Z",
      };

      const insumoDemo: Omit<Insumo, "id"> = {
        nombre: "Maiz clasificado",
        codigo: "PRD-DEMO-001",
        descripcion: "Producto demo para primera venta",
        categoria: "otros",
        unidad: "kg",
        iva: "10",
        costoUnitario: costoPromedioDemo,
        precioPromedioCalculado: costoPromedioDemo,
        precioVenta: precioVentaDemo,
        stockMinimo: 5,
        stockActual: stockDespuesDemo,
        proveedor: "Stock inicial demo",
        ultimaCompra: "2026-02-15T00:00:00.000Z",
      };

      const zafraContext = resolveZafraContext(zafras || [], DEMO_IDS.zafra, zafraDemo.nombre);
      const asientoVenta: Omit<AsientoDiario, "id"> = withZafraContext(
        {
          fecha: now.toISOString(),
          descripcion: `Venta s/ doc ${DEMO_NUMERO_DOCUMENTO}`,
          movimientos: [
            { cuentaId: cuentaClientesId, tipo: "debe", monto: subtotalDemo },
            { cuentaId: cuentaVentasId, tipo: "haber", monto: baseImponibleDemo },
            { cuentaId: cuentaIvaDebitoId, tipo: "haber", monto: iva10Demo },
          ],
        },
        zafraContext
      );
      const asientoCmv: Omit<AsientoDiario, "id"> = withZafraContext(
        {
          fecha: now.toISOString(),
          descripcion: `CMV por venta ${DEMO_NUMERO_DOCUMENTO}`,
          movimientos: [
            { cuentaId: cuentaCmvId, tipo: "debe", monto: costoTotalCmvDemo },
            { cuentaId: cuentaInventarioId, tipo: "haber", monto: costoTotalCmvDemo },
          ],
        },
        zafraContext
      );

      const movimientoStock: Omit<MovimientoStock, "id"> = {
        fecha: now.toISOString(),
        tipo: "salida",
        origen: "venta",
        documentoOrigen: DEMO_NUMERO_DOCUMENTO,
        ventaId: DEMO_IDS.venta,
        depositoId: DEMO_IDS.deposito,
        zafraId: DEMO_IDS.zafra,
        cultivo: cultivoDemo.nombre,
        insumoId: DEMO_IDS.insumo,
        insumoNombre: insumoDemo.descripcion,
        unidad: insumoDemo.unidad,
        categoria: insumoDemo.categoria,
        cantidad: cantidadDemo,
        stockAntes: stockAntesDemo,
        stockDespues: stockDespuesDemo,
        precioUnitario: precioVentaDemo,
        costoTotal: cantidadDemo * precioVentaDemo,
        creadoPor: user.uid,
        creadoEn: now,
      };

      const ventaDemo: Omit<Venta, "id"> = {
        numeroDocumento: DEMO_NUMERO_DOCUMENTO,
        clienteId: DEMO_IDS.cliente,
        zafraId: DEMO_IDS.zafra,
        cultivoId: DEMO_IDS.cultivo,
        fecha: now.toISOString(),
        moneda: "PYG",
        formaPago: FORMA_PAGO_CREDITO,
        totalizadora: false,
        vencimiento: vencimiento.toISOString(),
        depositoOrigenId: DEMO_IDS.deposito,
        observacion: descripcionDemo,
        items: [
          {
            productoId: DEMO_IDS.insumo,
            descripcion: insumoDemo.descripcion,
            cantidad: cantidadDemo,
            precioUnitario: precioVentaDemo,
            descuentoPorc: 0,
            subtotal: subtotalDemo,
          },
        ],
        total: subtotalDemo,
        financiero: {
          total: subtotalDemo,
          vencimiento: vencimiento.toISOString(),
          asientoVentaId: DEMO_IDS.asientoVenta,
          asientoCmvId: DEMO_IDS.asientoCmv,
        },
      };

      const cuentaPorCobrarDemo: Omit<CuentaPorCobrar, "id"> = {
        ventaId: DEMO_IDS.venta,
        ventaDocumento: DEMO_NUMERO_DOCUMENTO,
        clienteId: DEMO_IDS.cliente,
        zafraId: DEMO_IDS.zafra,
        zafraNombre: zafraContext.zafraNombre || zafraDemo.nombre,
        fechaEmision: now.toISOString(),
        fechaVencimiento: vencimiento.toISOString(),
        moneda: "PYG",
        montoOriginal: subtotalDemo,
        montoCobrado: 0,
        saldoPendiente: subtotalDemo,
        estado: calcularEstadoCuenta({
          montoOriginal: subtotalDemo,
          saldoPendiente: subtotalDemo,
          fechaVencimiento: vencimiento.toISOString(),
        }),
        cuentaContableId: cuentaClientesId,
        asientoVentaId: DEMO_IDS.asientoVenta,
        observacion: descripcionDemo,
        creadoPor: user.uid,
        creadoEn: now.toISOString(),
        actualizadoEn: now.toISOString(),
      };

      batch.set(tenant.doc("clientes", DEMO_IDS.cliente)!, clienteDemo, { merge: true });
      batch.set(tenant.doc("depositos", DEMO_IDS.deposito)!, depositoDemo, { merge: true });
      batch.set(tenant.doc("cultivos", DEMO_IDS.cultivo)!, cultivoDemo, { merge: true });
      batch.set(tenant.doc("zafras", DEMO_IDS.zafra)!, zafraDemo, { merge: true });
      batch.set(tenant.doc("insumos", DEMO_IDS.insumo)!, insumoDemo, { merge: true });
      batch.set(tenant.doc("asientosDiario", DEMO_IDS.asientoVenta)!, asientoVenta, { merge: true });
      batch.set(tenant.doc("asientosDiario", DEMO_IDS.asientoCmv)!, asientoCmv, { merge: true });
      batch.set(tenant.doc("MovimientosStock", DEMO_IDS.movimientoStock)!, movimientoStock, { merge: true });
      batch.set(tenant.doc("ventas", DEMO_IDS.venta)!, ventaDemo, { merge: true });
      batch.set(tenant.doc("cuentasPorCobrar", DEMO_IDS.venta)!, cuentaPorCobrarDemo, { merge: true });

      await batch.commit();
      toast({
        title: "Primera venta simulada",
        description: "Se crearon cliente, producto, stock, asientos y cuenta por cobrar de ejemplo.",
      });
    } catch (error: any) {
      console.error("No se pudo simular la primera venta:", error);
      toast({
        variant: "destructive",
        title: "No se pudo simular la venta",
        description: error?.message || "Error inesperado al crear la venta demo.",
      });
    } finally {
      setSimulatingFirstSale(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Gestion de Ventas"
        description="Consulte, edite y registre las ventas de productos."
      >
        <ReportActions reportTitle="Gestion de Ventas" reportSummary={shareSummary} />
        {shouldShowSimulation && (
          <Button
            variant="outline"
            onClick={handleSimularPrimeraVenta}
            disabled={isSimulatingFirstSale || isLoadingPlanDeCuentas}
          >
            {isSimulatingFirstSale ? <Loader2 className="animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {isSimulatingFirstSale ? "Creando venta demo..." : "Simular primera venta"}
          </Button>
        )}
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Venta
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Listado de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table resizable className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isLoadingVentas || isLoadingClientes || isLoadingDepositos || isLoadingZafras || isLoadingCultivos) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingVentas &&
                  !isLoadingClientes &&
                  !isLoadingDepositos &&
                  !isLoadingZafras &&
                  !isLoadingCultivos &&
                  (ventas?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No hay ventas registradas. Puede crear la primera manualmente o usar la simulacion de ejemplo.
                      </TableCell>
                    </TableRow>
                  )}
                {ventas?.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell>{venta.numeroDocumento}</TableCell>
                    <TableCell>{format(new Date(venta.fecha as string), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{getClienteNombre(venta.clienteId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{venta.moneda}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">${formatCurrency(venta.total)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openForm(venta)}>Ver/Editar</DropdownMenuItem>
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
      </div>

      <Dialog modal={false} open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent draggable className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {selectedVenta ? `Editar Venta NÂ° ${selectedVenta.numeroDocumento}` : "Registrar Nueva Venta"}
            </DialogTitle>
            <DialogDescription>Complete los detalles de la factura o documento de venta.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70dvh] sm:max-h-[78dvh] p-1 pr-2">
            <VentaForm
              venta={selectedVenta}
              onCancel={closeForm}
              clientes={clientes || []}
              depositos={depositos || []}
              cuentasCajaBanco={cuentasCajaBanco || []}
              zafras={zafras || []}
              cultivos={cultivos || []}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
