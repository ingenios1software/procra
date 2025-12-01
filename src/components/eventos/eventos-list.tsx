"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, TriangleAlert, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Evento, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useUser, useFirestore, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EventoForm } from "./evento-form";
import { collection, doc } from "firebase/firestore";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";


export function EventosList({ eventos, parcelas, zafras, cultivos, isLoading }: { eventos: Evento[], parcelas: Parcela[], zafras: Zafra[], cultivos: Cultivo[], isLoading: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);

  const [filters, setFilters] = useState({
    tipo: "",
    parcelaId: "",
    zafraId: "",
  });

  const handleFilterChange = (
    filterName: keyof typeof filters,
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const filteredEventos = useMemo(() => {
    if (!eventos) return [];
    return eventos.filter((evento) => {
      return (
        (filters.tipo ? evento.tipo === filters.tipo : true) &&
        (filters.parcelaId ? evento.parcelaId === filters.parcelaId : true) &&
        (filters.zafraId ? evento.zafraId === filters.zafraId : true)
      );
    });
  }, [eventos, filters]);

  const eventTypes = useMemo(() => {
    if (!eventos) return [];
    return [...new Set(eventos.map((e) => e.tipo))];
  }, [eventos]);


  const handleExportPDF = () => {
    alert("Funcionalidad 'Exportar PDF' pendiente de implementación.");
  };

  const handleSave = (eventoData: Omit<Evento, 'id'>) => {
    if (!firestore) return;
    const dataToSave = {...eventoData, fecha: (eventoData.fecha as Date).toISOString() };

    if (selectedEvento) {
        const eventoRef = doc(firestore, 'eventos', selectedEvento.id);
        updateDocumentNonBlocking(eventoRef, dataToSave);
        toast({ title: "Evento actualizado" });
    } else {
        const eventosCol = collection(firestore, 'eventos');
        addDocumentNonBlocking(eventosCol, dataToSave);
        toast({ title: "Evento creado" });
    }
    closeForm();
  };

  const openForm = (evento?: Evento) => {
    setSelectedEvento(evento || null);
    setFormOpen(true);
  }

  const closeForm = () => {
    setFormOpen(false);
    setSelectedEvento(null);
  }

  return (
    <>
      <PageHeader
        title="Registro de Actividades"
        description="Consulte y gestione todas las actividades operativas realizadas en campo."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          {user && (
            <Button asChild>
              <Link href="/eventos/crear">
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Evento
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-4 py-4">
            <Select
              value={filters.tipo}
              onValueChange={(value) =>
                handleFilterChange("tipo", value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.parcelaId}
              onValueChange={(value) =>
                handleFilterChange("parcelaId", value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por parcela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las parcelas</SelectItem>
                {parcelas?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.zafraId}
              onValueChange={(value) =>
                handleFilterChange("zafraId", value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por zafra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zafras</SelectItem>
                {zafras?.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cultivo</TableHead>
                  <TableHead>Descripción</TableHead>
                  {user && (
                    <TableHead className="text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center">Cargando...</TableCell></TableRow>}
                {filteredEventos.map((evento) => {
                  const parcela = parcelas?.find((p) => p.id === evento.parcelaId);
                  const cultivo = cultivos?.find((c) => c.id === evento.cultivoId);
                  const showAlert =
                    evento.productos && evento.productos.length > 0 && !evento.costoTotal;

                  return (
                    <TableRow key={evento.id}>
                      <TableCell>
                        {format(new Date(evento.fecha as string), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {parcela?.nombre || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {evento.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{cultivo?.nombre || "N/A"}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {evento.descripcion}
                        {showAlert && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <TriangleAlert className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Falta información de cantidad o unidad para
                                  los insumos.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {evento.tipo === "plagas" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive">Alerta</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Este evento de plagas genera una alerta en el
                                  dashboard.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                              <DropdownMenuItem onClick={() => openForm(evento)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedEvento ? 'Editar Evento' : 'Registrar Nuevo Evento'}</DialogTitle>
            <DialogDescription>
                Complete los detalles de la actividad agrícola. El panel superior le dará contexto agronómico.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[80vh] p-1">
            <EventoForm 
                evento={selectedEvento}
                onSave={handleSave}
                onCancel={closeForm}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
