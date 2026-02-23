"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PlanDeCuentasForm } from "@/components/contabilidad/plan-de-cuentas/plan-de-cuentas-form";
import type { PlanDeCuenta, AsientoDiario } from "@/lib/types";
import { useUser, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { collection, doc, query, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import { findPlanCuentaByCodigo, getCuentasBaseFaltantes } from "@/lib/contabilidad/cuentas-base";


export default function PlanDeCuentasPage() {
  const firestore = useFirestore();
  const planDeCuentasQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'planDeCuentas'), orderBy('codigo')) : null
  , [firestore]);
  const { data: cuentas, isLoading } = useCollection<PlanDeCuenta>(planDeCuentasQuery);

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<PlanDeCuenta | null>(
    null
  );
  const { user } = useUser();
  const { toast } = useToast();

  const handleSave = (cuentaData: Omit<PlanDeCuenta, "id">) => {
    if (!firestore) return;

    if (selectedCuenta) {
      // Update
      const cuentaRef = doc(firestore, 'planDeCuentas', selectedCuenta.id);
      updateDocumentNonBlocking(cuentaRef, cuentaData);
      toast({
        title: "Cuenta actualizada",
        description: `La cuenta "${cuentaData.nombre}" ha sido actualizada.`,
      });
    } else {
      // Create
      const cuentasCol = collection(firestore, 'planDeCuentas');
      addDocumentNonBlocking(cuentasCol, cuentaData);
      toast({
        title: "Cuenta creada",
        description: `La cuenta "${cuentaData.nombre}" ha sido creada.`,
      });
    }
    setFormOpen(false);
    setSelectedCuenta(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore || !cuentas) return;
    const cuenta = cuentas.find((c) => c.id === id);
    const cuentaRef = doc(firestore, 'planDeCuentas', id);
    deleteDocumentNonBlocking(cuentaRef);
    toast({
      variant: "destructive",
      title: "Cuenta eliminada",
      description: `La cuenta "${cuenta?.nombre}" ha sido eliminada.`,
    });
  };

  const handleCargarCuentasBase = async () => {
    if (!firestore) return;
    const faltantes = getCuentasBaseFaltantes(cuentas || []);
    if (faltantes.length === 0) {
      toast({
        title: "Plan de cuentas al dia",
        description: "No hay cuentas base pendientes de crear.",
      });
      return;
    }

    try {
      const batch = writeBatch(firestore);
      const cuentasCol = collection(firestore, "planDeCuentas");
      for (const cuenta of faltantes) {
        const ref = doc(cuentasCol);
        batch.set(ref, cuenta);
      }
      await batch.commit();
      toast({
        title: "Cuentas base creadas",
        description: `Se agregaron ${faltantes.length} cuentas sugeridas para compras, ventas y eventos.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudieron crear cuentas base",
        description: error?.message || "Error inesperado.",
      });
    }
  };

  const handleNormalizarAsientos = async () => {
    if (!firestore || !cuentas || cuentas.length === 0) return;

    try {
      const cuentasPorId = new Set(cuentas.map((c) => c.id));
      const asientosSnap = await getDocs(collection(firestore, "asientosDiario"));
      if (asientosSnap.empty) {
        toast({ title: "Sin asientos", description: "No hay asientos para normalizar." });
        return;
      }

      let batch = writeBatch(firestore);
      let pendingOps = 0;
      let asientosActualizados = 0;
      let movimientosNormalizados = 0;

      for (const asientoDoc of asientosSnap.docs) {
        const data = asientoDoc.data() as AsientoDiario;
        const movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];

        let changed = false;
        const movimientosNormalizadosActuales = movimientos.map((mov) => {
          if (cuentasPorId.has(mov.cuentaId)) return mov;
          const cuentaByCodigo = findPlanCuentaByCodigo(cuentas, mov.cuentaId);
          if (!cuentaByCodigo?.id) return mov;
          changed = true;
          movimientosNormalizados += 1;
          return { ...mov, cuentaId: cuentaByCodigo.id };
        });

        if (!changed) continue;

        batch.update(asientoDoc.ref, { movimientos: movimientosNormalizadosActuales });
        pendingOps += 1;
        asientosActualizados += 1;

        if (pendingOps >= 400) {
          await batch.commit();
          batch = writeBatch(firestore);
          pendingOps = 0;
        }
      }

      if (pendingOps > 0) {
        await batch.commit();
      }

      toast({
        title: "Asientos normalizados",
        description: `Se actualizaron ${asientosActualizados} asientos y ${movimientosNormalizados} movimientos.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudieron normalizar asientos",
        description: error?.message || "Error inesperado.",
      });
    }
  };

  const openForm = (cuenta?: PlanDeCuenta) => {
    setSelectedCuenta(cuenta || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Plan de Cuentas"
        description="Administre el plan contable de la empresa."
      >
        {user && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleCargarCuentasBase}>
              Cargar Cuentas Base
            </Button>
            <Button variant="outline" onClick={handleNormalizarAsientos}>
              Normalizar Asientos
            </Button>
            <Button onClick={() => openForm()}>
              <PlusCircle />
              Nueva Cuenta
            </Button>
          </div>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Naturaleza</TableHead>
                {user && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
              {cuentas?.map((cuenta) => (
                  <TableRow key={cuenta.id}>
                    <TableCell className="font-mono">{cuenta.codigo}</TableCell>
                    <TableCell className="font-medium">{cuenta.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {cuenta.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {cuenta.naturaleza}
                    </TableCell>
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
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openForm(cuenta)}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(cuenta.id)}
                              className="text-destructive"
                            >
                              Eliminar
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
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>
              {selectedCuenta ? "Editar Cuenta" : "Crear Nueva Cuenta"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles de la cuenta contable.
            </DialogDescription>
          </DialogHeader>
          <PlanDeCuentasForm
            cuenta={selectedCuenta}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedCuenta(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
