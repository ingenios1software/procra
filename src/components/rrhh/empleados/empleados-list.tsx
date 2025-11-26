
"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmpleadoForm } from "./empleado-form";
import type { Empleado, Rol } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EmpleadosListProps {
  initialEmpleados: Empleado[];
  roles: Rol[];
}

export function EmpleadosList({ initialEmpleados }: EmpleadosListProps) {
  const [empleados, setEmpleados] = useState(initialEmpleados);
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
  const { role } = useAuth();
  const { toast } = useToast();
  const canModify = role === "admin";

  const handleSave = (empleadoData: Omit<Empleado, "id">) => {
    if (selectedEmpleado) {
      // Update
      const updatedEmpleado = { ...selectedEmpleado, ...empleadoData };
      setEmpleados((prev) =>
        prev.map((e) => (e.id === updatedEmpleado.id ? updatedEmpleado : e))
      );
      toast({
        title: "Empleado actualizado",
        description: `Los datos de ${updatedEmpleado.nombre} ${updatedEmpleado.apellido} han sido actualizados.`,
      });
    } else {
      // Create
      const newEmpleado: Empleado = {
        id: `emp-${Date.now()}`,
        ...empleadoData,
      };
      setEmpleados((prev) => [...prev, newEmpleado]);
      toast({
        title: "Empleado creado",
        description: `El empleado ${newEmpleado.nombre} ${newEmpleado.apellido} ha sido registrado.`,
      });
    }
    setFormOpen(false);
    setSelectedEmpleado(null);
  };

  const handleDelete = (id: string) => {
    const empleado = empleados.find((e) => e.id === id);
    setEmpleados((prev) => prev.filter((e) => e.id !== id));
    toast({
      variant: "destructive",
      title: "Empleado eliminado",
      description: `El empleado ${empleado?.nombre} ${empleado?.apellido} ha sido eliminado.`,
    });
  };

  const openForm = (empleado?: Empleado) => {
    setSelectedEmpleado(empleado || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Empleados"
        description="Administre la información del personal de la empresa."
      >
        {canModify && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nuevo Empleado
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Personal</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre Completo</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Puesto</TableHead>
                <TableHead>Fecha de Contratación</TableHead>
                <TableHead>Estado</TableHead>
                {canModify && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {empleados.map((empleado) => (
                <TableRow key={empleado.id}>
                  <TableCell className="font-medium">
                    {empleado.nombre} {empleado.apellido}
                  </TableCell>
                  <TableCell>{empleado.documento}</TableCell>
                  <TableCell>{empleado.puesto}</TableCell>
                  <TableCell>
                    {format(new Date(empleado.fechaContratacion), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn("capitalize", {
                        "bg-green-600 text-white": empleado.estado === "activo",
                        "bg-yellow-500 text-black":
                          empleado.estado === "de vacaciones",
                        "bg-destructive text-destructive-foreground":
                          empleado.estado === "inactivo",
                      })}
                    >
                      {empleado.estado}
                    </Badge>
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
                          <DropdownMenuItem onClick={() => openForm(empleado)}>
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
                                  ¿Está seguro de que desea eliminar a este
                                  empleado?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto
                                  eliminará permanentemente al empleado de sus
                                  registros.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(empleado.id)}
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[725px]">
          <DialogHeader>
            <DialogTitle>
              {selectedEmpleado ? "Editar Empleado" : "Registrar Nuevo Empleado"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles del empleado.
            </DialogDescription>
          </DialogHeader>
          <EmpleadoForm
            empleado={selectedEmpleado}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedEmpleado(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
