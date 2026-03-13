"use client";

import { useState, useMemo } from "react";
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
import { AsistenciaForm } from "@/components/rrhh/asistencias/asistencia-form";
import type { Asistencia, Empleado } from "@/lib/types";
import { useUser, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { orderBy } from 'firebase/firestore';
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { getEmpleadoEtiqueta } from "@/lib/empleados";


export default function AsistenciasPage() {
  const tenant = useTenantFirestore();
  const { user } = useUser();

  const asistenciasQuery = useMemoFirebase(() => tenant.query('asistencias', orderBy('fecha', 'desc')), [tenant]);
  const { data: asistencias, isLoading: isLoadingAsistencias } = useCollection<Asistencia>(asistenciasQuery);

  const empleadosQuery = useMemoFirebase(() => tenant.collection('empleados'), [tenant]);
  const { data: empleados, isLoading: isLoadingEmpleados } = useCollection<Empleado>(empleadosQuery);
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedAsistencia, setSelectedAsistencia] = useState<Asistencia | null>(
    null
  );
  
  const { toast } = useToast();

  const getEmpleadoNombre = (empleadoId: string) => {
    if (!empleados) return "N/A";
    const empleado = empleados.find((e) => e.id === empleadoId);
    return empleado ? getEmpleadoEtiqueta(empleado) : empleadoId;
  };

  const calculateHoras = (entrada: string, salida: string) => {
    if (!entrada || !salida) return 0;
    const [hEntrada, mEntrada] = entrada.split(":").map(Number);
    const [hSalida, mSalida] = salida.split(":").map(Number);
    const entradaMinutos = hEntrada * 60 + mEntrada;
    const salidaMinutos = hSalida * 60 + mSalida;
    if (salidaMinutos < entradaMinutos) return 0; // No soporta turnos nocturnos aún
    return ((salidaMinutos - entradaMinutos) / 60).toFixed(2);
  };

  const handleSave = (asistenciaData: Omit<Asistencia, "id">) => {
    if (selectedAsistencia) {
      const asistenciaRef = tenant.doc('asistencias', selectedAsistencia.id);
      if (!asistenciaRef) return;
      updateDocumentNonBlocking(asistenciaRef, asistenciaData);
      toast({
        title: "Registro actualizado",
        description: `La asistencia ha sido actualizada.`,
      });
    } else {
      const asistenciasCol = tenant.collection('asistencias');
      if (!asistenciasCol) return;
      addDocumentNonBlocking(asistenciasCol, asistenciaData);
      toast({
        title: "Asistencia registrada",
        description: `Se ha creado un nuevo registro de asistencia.`,
      });
    }
    setFormOpen(false);
    setSelectedAsistencia(null);
  };

  const handleDelete = (id: string) => {
    const asistenciaRef = tenant.doc('asistencias', id);
    if (!asistenciaRef) return;
    deleteDocumentNonBlocking(asistenciaRef);
    toast({
      variant: "destructive",
      title: "Registro eliminado",
      description: `El registro de asistencia ha sido eliminado.`,
    });
  };

  const openForm = (asistencia?: Asistencia) => {
    setSelectedAsistencia(asistencia || null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Registro de Asistencias"
        description="Gestione la asistencia y horas trabajadas del personal."
      >
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle />
            Nuevo Registro
          </Button>
        )}
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Listado de Asistencias</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Horas</TableHead>
                <TableHead>Observaciones</TableHead>
                {user && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoadingAsistencias || isLoadingEmpleados) && <TableRow><TableCell colSpan={7}>Cargando...</TableCell></TableRow>}
              {asistencias?.map((asistencia) => (
                  <TableRow key={asistencia.id}>
                    <TableCell>
                      {format(new Date(asistencia.fecha), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getEmpleadoNombre(asistencia.empleadoId)}
                    </TableCell>
                    <TableCell>{asistencia.horaEntrada}</TableCell>
                    <TableCell>{asistencia.horaSalida}</TableCell>
                    <TableCell>
                      {calculateHoras(
                        asistencia.horaEntrada,
                        asistencia.horaSalida
                      )}
                    </TableCell>
                    <TableCell>{asistencia.observaciones}</TableCell>
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
                            <DropdownMenuItem
                              onClick={() => openForm(asistencia)}
                            >
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
                                    ¿Está seguro de que desea eliminar este
                                    registro?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(asistencia.id)}
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
      <Dialog modal={false} open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent draggable className="sm:max-w-[625px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAsistencia
                ? "Editar Registro de Asistencia"
                : "Crear Nuevo Registro"}
            </DialogTitle>
            <DialogDescription>
              Complete los detalles de la asistencia.
            </DialogDescription>
          </DialogHeader>
          <AsistenciaForm
            asistencia={selectedAsistencia}
            empleados={empleados || []}
            onSubmit={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setSelectedAsistencia(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
