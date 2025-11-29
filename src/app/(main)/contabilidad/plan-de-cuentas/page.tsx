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
import type { PlanDeCuenta } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useDataStore } from "@/store/data-store";

export default function PlanDeCuentasPage() {
  const { planDeCuentas } = useDataStore();
  const [cuentas, setCuentas] = useState(planDeCuentas);
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<PlanDeCuenta | null>(
    null
  );
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === "admin";

  const handleSave = (cuentaData: Omit<PlanDeCuenta, "id">) => {
    if (selectedCuenta) {
      // Update
      const updatedCuenta = { ...selectedCuenta, ...cuentaData };
      setCuentas((prev) =>
        prev.map((c) => (c.id === updatedCuenta.id ? updatedCuenta : c))
      );
      toast({
        title: "Cuenta actualizada",
        description: `La cuenta "${updatedCuenta.nombre}" ha sido actualizada.`,
      });
    } else {
      // Create
      const newCuenta: PlanDeCuenta = {
        id: `cta-${Date.now()}`,
        ...cuentaData,
      };
      setCuentas((prev) => [...prev, newCuenta]);
      toast({
        title: "Cuenta creada",
        description: `La cuenta "${newCuenta.nombre}" ha sido creada.`,
      });
    }
    setFormOpen(false);
    setSelectedCuenta(null);
  };

  const handleDelete = (id: string) => {
    const cuenta = cuentas.find((c) => c.id === id);
    setCuentas((prev) => prev.filter((c) => c.id !== id));
    toast({
      variant: "destructive",
      title: "Cuenta eliminada",
      description: `La cuenta "${cuenta?.nombre}" ha sido eliminada.`,
    });
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
        {canModify && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nueva Cuenta
          </Button>
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
                {canModify && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentas
                .sort((a, b) => a.codigo.localeCompare(b.codigo))
                .map((cuenta) => (
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
