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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { ControlHorario, Empleado, Parcela } from "@/lib/types";
import { useUser, useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { collection, doc } from 'firebase/firestore';

interface ControlHorarioListProps {
  registros: ControlHorario[];
  empleados: Empleado[];
  parcelas: Parcela[];
  isLoading: boolean;
}

export function ControlHorarioList({ registros, empleados, parcelas, isLoading }: ControlHorarioListProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<ControlHorario | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const getEmpleadoNombre = (empleadoId: string) => {
    const empleado = empleados.find((e) => e.id === empleadoId);
    return empleado ? `${empleado.nombre} ${empleado.apellido}` : "N/A";
  };
  
  const getParcelaNombre = (parcelaId: string) => {
    return parcelas.find((p) => p.id === parcelaId)?.nombre || "N/A";
  }

  const handleSave = (registroData: Omit<ControlHorario, "id">) => {
    if (!firestore) return;

    if (selectedRegistro) {
      const registroRef = doc(firestore, 'controlHorario', selectedRegistro.id);
      updateDocumentNonBlocking(registroRef, registroData);
      toast({ title: "Registro actualizado" });
    } else {
      const registroCol = collection(firestore, 'controlHorario');
      addDocumentNonBlocking(registroCol, registroData);
      toast({ title: "Registro creado" });
    }
    setFormOpen(false);
    setSelectedRegistro(null);
  };

  const handleDelete = (id: string) => {
    if (!firestore) return;
    const registroRef = doc(firestore, 'controlHorario', id);
    deleteDocumentNonBlocking(registroRef);
    toast({ variant: "destructive", title: "Registro eliminado" });
  };

  const openForm = (registro?: ControlHorario) => {
    setSelectedRegistro(registro || null);
    setFormOpen(true);
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  return (
    <>
      <PageHeader
        title="Control de Horario por Actividad"
        description="Registre las horas trabajadas por los empleados en diferentes actividades y parcelas."
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
          <CardTitle>Listado de Registros</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>N° Actividades</TableHead>
                {user && (
                  <TableHead className="text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
              {registros?.map((registro) => {
                const isExpanded = expandedRows.has(registro.id);
                return (
                  <>
                    <TableRow key={registro.id} onClick={() => toggleRow(registro.id)} className="cursor-pointer">
                      <TableCell><Button variant="ghost" size="icon" className="h-8 w-8">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></TableCell>
                      <TableCell>{format(new Date(registro.fecha), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{getEmpleadoNombre(registro.empleadoId)}</TableCell>
                      <TableCell>{registro.actividades.length}</TableCell>
                      {user && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Abrir menú</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openForm(registro)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(registro.id)} className="text-destructive">Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && (
                       <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="p-0">
                            <div className="p-4">
                                <h4 className="font-semibold mb-2 ml-2">Detalle de Actividades:</h4>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Parcela</TableHead><TableHead>Descripción</TableHead><TableHead>Inicio</TableHead><TableHead>Fin</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {registro.actividades.map((act, index) => (
                                            <TableRow key={index} className="border-b-0">
                                                <TableCell>{getParcelaNombre(act.parcelaId)}</TableCell>
                                                <TableCell>{act.descripcion}</TableCell>
                                                <TableCell>{act.horaInicio}</TableCell>
                                                <TableCell>{act.horaFin}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                          </TableCell>
                       </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[725px]">
          <DialogHeader>
            <DialogTitle>{selectedRegistro ? "Editar Registro" : "Crear Nuevo Registro de Horario"}</DialogTitle>
          </DialogHeader>
          <p>El formulario para Control de Horario (control-horario-form.tsx) no está implementado aún.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
