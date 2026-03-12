"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { addDoc, deleteField, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { Check, FileText, MoreHorizontal, Pencil, PlusCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import type { Cultivo, Evento, Parcela, Zafra } from "@/lib/types";
import { useUser, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { procesarConsumoDeStockDesdeEvento } from "@/lib/stock/consumo-desde-evento";
import { EventoForm } from "./evento-form";
import { EventoComprobante } from "./evento-comprobante";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { useAuth } from "@/hooks/use-auth";
import { canApproveEvento } from "@/lib/eventos/approval";

interface EventosListProps {
  eventos: Evento[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
  isLoading: boolean;
}

export function EventosList({ eventos, parcelas, zafras, cultivos, isLoading }: EventosListProps) {
  const { user } = useUser();
  const { role, permisos, user: usuarioApp } = useAuth();
  const tenant = useTenantFirestore();
  const firestore = tenant.firestore;
  const { toast } = useToast();

  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [dialogView, setDialogView] = useState<"form" | "receipt">("form");
  const [filters, setFilters] = useState({
    tipo: "",
    parcelaId: "",
    zafraId: "",
    numeroLanzamiento: "",
    estado: "",
  });

  const filteredEventos = useMemo(() => {
    return (eventos || []).filter((evento) => {
      const numeroMatch = filters.numeroLanzamiento
        ? evento.numeroLanzamiento?.toString().includes(filters.numeroLanzamiento)
        : true;

      return (
        numeroMatch &&
        (filters.tipo ? evento.tipo === filters.tipo : true) &&
        (filters.parcelaId ? evento.parcelaId === filters.parcelaId : true) &&
        (filters.zafraId ? evento.zafraId === filters.zafraId : true) &&
        (filters.estado ? evento.estado === filters.estado : true)
      );
    });
  }, [eventos, filters]);

  const eventTypes = useMemo(() => [...new Set((eventos || []).map((evento) => evento.tipo))], [eventos]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
  };

  const closeForm = () => {
    setFormOpen(false);
    setSelectedEvento(null);
    setDialogView("form");
  };

  const openForm = (evento?: Evento) => {
    setSelectedEvento(evento || null);
    setDialogView("form");
    setFormOpen(true);
  };

  const syncMaquinariaHorometro = async (eventoData: Omit<Evento, "id">) => {
    if (!eventoData.maquinariaId) return;

    const horometroActual = Number(eventoData.horometroActual);
    if (Number.isNaN(horometroActual) || horometroActual < 0) return;

    const maquinariaRef = tenant.doc("maquinaria", eventoData.maquinariaId);
    if (!maquinariaRef) return;
    const maquinariaSnapshot = await getDoc(maquinariaRef);
    if (!maquinariaSnapshot.exists()) return;

    const horasRegistradas = Number(maquinariaSnapshot.data().horasTrabajo) || 0;
    const horasASincronizar = Math.max(horasRegistradas, horometroActual);

    if (horasASincronizar !== horasRegistradas) {
      await updateDoc(maquinariaRef, { horasTrabajo: horasASincronizar });
    }
  };

  const handleSave = async (eventoData: Omit<Evento, "id">) => {
    if (!firestore || !user) {
      throw new Error("No hay sesion o conexion a Firestore disponible.");
    }

    try {
      if (selectedEvento) {
        const camposMaquinaria: Array<keyof Pick<Evento, "maquinariaId" | "horometroAnterior" | "horometroActual" | "horasTrabajadas">> = [
          "maquinariaId",
          "horometroAnterior",
          "horometroActual",
          "horasTrabajadas",
        ];
        const dataBase = Object.fromEntries(
          Object.entries(eventoData).filter(([, value]) => value !== undefined)
        );
        const dataToSave: Record<string, unknown> = {
          ...dataBase,
          fecha: (eventoData.fecha as Date).toISOString(),
        };
        for (const campo of camposMaquinaria) {
          if (eventoData[campo] === undefined) {
            dataToSave[campo] = deleteField();
          }
        }
        const eventoRef = tenant.doc("eventos", selectedEvento.id);
        if (!eventoRef) throw new Error("No se pudo resolver el evento dentro de la empresa actual.");
        await updateDoc(eventoRef, dataToSave);
        await syncMaquinariaHorometro(eventoData);
        const eventoActualizado = {
          ...selectedEvento,
          ...dataBase,
          fecha: (eventoData.fecha as Date).toISOString(),
          id: selectedEvento.id,
        } as Evento;
        for (const campo of camposMaquinaria) {
          if (eventoData[campo] === undefined) {
            delete eventoActualizado[campo];
          }
        }
        setSelectedEvento(eventoActualizado);
        setDialogView("receipt");
        toast({ title: "Evento actualizado" });
        return;
      }

      const eventosCol = tenant.collection("eventos");
      if (!eventosCol) {
        throw new Error("No se pudo resolver la coleccion de eventos para la empresa actual.");
      }
      const qLanzamiento = query(eventosCol, orderBy("numeroLanzamiento", "desc"), limit(1));
      const lanzSnapshot = await getDocs(qLanzamiento);
      const qItem = query(eventosCol, orderBy("numeroItem", "desc"), limit(1));
      const itemSnapshot = await getDocs(qItem);

      const maxLanzamiento = lanzSnapshot.empty ? 0 : lanzSnapshot.docs[0].data().numeroLanzamiento || 0;
      const maxNumeroItem = itemSnapshot.empty ? 0 : itemSnapshot.docs[0].data().numeroItem || 0;

      const cleanData = Object.fromEntries(
        Object.entries(eventoData).filter(([, value]) => value !== undefined)
      );

      const dataToSave = {
        ...cleanData,
        fecha: (eventoData.fecha as Date).toISOString(),
        numeroLanzamiento: maxLanzamiento + 1,
        numeroItem: maxNumeroItem + 1,
        estado: "pendiente" as const,
        creadoPor: user.uid,
        creadoEn: serverTimestamp(),
      };

      const docRef = await addDoc(eventosCol, dataToSave);
      const eventoGuardado: Evento & { id: string } = {
        ...(eventoData as Evento),
        ...dataToSave,
        id: docRef.id,
        creadoEn: new Date(),
      };
      await syncMaquinariaHorometro(eventoGuardado);

      const { success, errors } = await procesarConsumoDeStockDesdeEvento(
        eventoGuardado,
        firestore,
        user.uid,
        tenant.empresaId
      );
      const tipoNormalizado = (eventoGuardado.tipo || "").toString().toLowerCase();
      const esCosecha = tipoNormalizado === "cosecha" || tipoNormalizado === "rendimiento";

      if (success && esCosecha) {
        eventoGuardado.stockProcesadoEn = new Date().toISOString();
        eventoGuardado.stockProcesadoPor = user.uid;
        toast({
          title: "Cosecha procesada",
          description: "Se actualizo stock de granos, rendimiento por parcela y valorizacion del servicio.",
        });
      } else if (!success) {
        toast({
          variant: "destructive",
          title: "Evento creado con advertencias",
          description: errors.join(". "),
        });
      }

      toast({
        title: `Evento #${dataToSave.numeroLanzamiento} (Item NÂº ${dataToSave.numeroItem}) creado`,
        description: `El evento "${eventoData.descripcion}" ha sido guardado y estÃ¡ pendiente de aprobaciÃ³n.`,
      });

      setSelectedEvento(eventoGuardado);
      setDialogView("receipt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el evento.";
      toast({
        variant: "destructive",
        title: "No se pudo guardar el evento",
        description: message,
      });
      throw error;
    }
  };

  const handleDelete = (id: string) => {
    const eventoRef = tenant.doc("eventos", id);
    if (!eventoRef) return;
    deleteDocumentNonBlocking(eventoRef);
    toast({
      variant: "destructive",
      title: "Evento eliminado",
      description: "El evento ha sido eliminado correctamente.",
    });
  };

  const shareSummary = `Eventos: ${eventos.length}.`;
  const eventoPrintTargetId = "evento-form-print-area";
  const eventoReceiptTargetId = "evento-receipt-target";
  const selectedParcela = selectedEvento ? parcelas.find((parcela) => parcela.id === selectedEvento.parcelaId) : null;
  const selectedZafra = selectedEvento ? zafras.find((zafra) => zafra.id === selectedEvento.zafraId) : null;
  const selectedCultivo = selectedEvento ? cultivos.find((cultivo) => cultivo.id === selectedEvento.cultivoId) : null;

  const selectedEventoSummary = selectedEvento
    ? [
        `Evento #${selectedEvento.numeroLanzamiento || "N/A"}`,
        `Fecha: ${format(new Date(selectedEvento.fecha as string), "dd/MM/yyyy")}`,
        `Parcela: ${selectedParcela?.nombre || "N/A"}`,
        `Cultivo: ${selectedCultivo?.nombre || "N/A"}`,
        `Zafra: ${selectedZafra?.nombre || "N/A"}`,
        `Tipo: ${selectedEvento.tipo}`,
        `Estado: ${selectedEvento.estado || "pendiente"}`,
        `Descripcion: ${selectedEvento.descripcion || "-"}`,
      ].join(" | ")
    : "Registro de nuevo evento en campo.";

  const dialogTitle = selectedEvento
    ? dialogView === "receipt"
      ? `Comprobante Evento #${selectedEvento.numeroLanzamiento}`
      : `Revisar Evento #${selectedEvento.numeroLanzamiento}`
    : "Registrar Nuevo Evento";

  const dialogDescription = selectedEvento
    ? dialogView === "receipt"
      ? "Comprobante listo para imprimir, descargar en PDF o compartir."
      : "Complete o revise los detalles de la actividad agricola."
    : "Complete los detalles de la actividad agricola. El panel superior le dara contexto agronomico.";
  const canApproveSelectedEvento =
    Boolean(selectedEvento) &&
    selectedEvento?.estado !== "aprobado" &&
    selectedEvento?.estado !== "rechazado" &&
    canApproveEvento({ permisos, role, usuarioApp });

  const handleApproveSelectedEvento = () => {
    if (!user || !selectedEvento) return;

    const eventoRef = tenant.doc("eventos", selectedEvento.id);
    if (!eventoRef) return;

    updateDocumentNonBlocking(eventoRef, {
      estado: "aprobado",
      aprobadoPor: user.uid,
      aprobadoPorNombre: usuarioApp?.nombre || user.email || user.uid,
      aprobadoEn: serverTimestamp(),
    });

    setSelectedEvento({
      ...selectedEvento,
      estado: "aprobado",
      aprobadoPor: user.uid,
      aprobadoPorNombre: usuarioApp?.nombre || user.email || user.uid,
      aprobadoEn: new Date().toISOString(),
    });

    toast({
      title: "Evento Aprobado",
      description: "El evento ha sido marcado como aprobado.",
    });
  };

  const dialogPanelClassName =
    "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 sm:px-5 sm:pb-6 xl:px-6";

  return (
    <>
      <PageHeader
        title="Registro de Actividades"
        description="Consulte y gestione todas las actividades operativas realizadas en campo."
      >
        <ReportActions reportTitle="Registro de Actividades" reportSummary={shareSummary} />
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Evento
          </Button>
        )}
      </PageHeader>

      <div id="pdf-area" className="print-area">
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Busqueda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-4 md:flex-row">
              <Input
                placeholder="Buscar por NÂ°..."
                value={filters.numeroLanzamiento}
                onChange={(e) => handleFilterChange("numeroLanzamiento", e.target.value)}
                className="w-full md:w-[180px]"
              />

              <Select
                value={filters.tipo}
                onValueChange={(value) => handleFilterChange("tipo", value === "all" ? "" : value)}
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
                onValueChange={(value) => handleFilterChange("parcelaId", value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por parcela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las parcelas</SelectItem>
                  {parcelas.map((parcela) => (
                    <SelectItem key={parcela.id} value={parcela.id}>
                      {parcela.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.estado}
                onValueChange={(value) => handleFilterChange("estado", value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Item NÂº</TableHead>
                    <TableHead>NÂ° Lanz.</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Descripcion</TableHead>
                    {user && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  )}

                  {filteredEventos.map((evento) => {
                    const parcela = parcelas.find((item) => item.id === evento.parcelaId);

                    return (
                      <TableRow key={evento.id} onClick={() => openForm(evento)} className="cursor-pointer">
                        <TableCell className="font-medium text-muted-foreground">{evento.numeroItem}</TableCell>
                        <TableCell className="font-bold text-muted-foreground">{evento.numeroLanzamiento}</TableCell>
                        <TableCell>{format(new Date(evento.fecha as string), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="font-medium">{parcela?.nombre || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {evento.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              evento.estado === "aprobado"
                                ? "default"
                                : evento.estado === "rechazado"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={cn({
                              "bg-green-600 text-white": evento.estado === "aprobado",
                              "bg-yellow-500 text-black": evento.estado === "pendiente",
                            })}
                          >
                            {evento.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex items-center gap-2">
                          {evento.descripcion}
                          {evento.estado === "rechazado" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <TriangleAlert className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{evento.motivoRechazo || "Evento rechazado"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                        {user && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openForm(evento)}>
                                  Ver / Aprobar
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
                                      <AlertDialogTitle>Esta seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta accion es permanente y eliminara el evento del sistema.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(evento.id)}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog modal={false} open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent
          draggable
          className="flex !h-[96dvh] !max-h-[96dvh] !w-[calc(100vw-1rem)] !max-w-[calc(100vw-1rem)] flex-col gap-0 !overflow-hidden rounded-none p-0 text-[17px] sm:!h-[95dvh] sm:!w-[calc(100vw-2rem)] sm:!max-w-[calc(100vw-2rem)] sm:rounded-xl xl:!w-[min(98vw,1700px)] xl:!max-w-[1700px] 2xl:!w-[min(98vw,1840px)] 2xl:!max-w-[1840px]"
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
              <div className="min-w-0 space-y-1 pr-10">
                <DialogTitle className="text-xl leading-tight sm:text-[1.7rem]">{dialogTitle}</DialogTitle>
                <DialogDescription className="text-sm leading-5 text-muted-foreground sm:text-[15px]">
                  {dialogDescription}
                </DialogDescription>
              </div>

              <div className="flex min-w-0 flex-col gap-2 xl:min-w-fit xl:items-end">
                {selectedEvento && (
                  <div className="flex flex-wrap gap-2 no-print xl:justify-end">
                    {canApproveSelectedEvento && (
                      <Button type="button" size="sm" className="h-9 px-3.5 text-[15px]" onClick={handleApproveSelectedEvento}>
                        <Check className="mr-1 h-4 w-4" />
                        Aprobar
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3.5 text-[15px]"
                      variant={dialogView === "receipt" ? "default" : "outline"}
                      onClick={() => setDialogView("receipt")}
                    >
                      <FileText className="mr-1 h-4 w-4" />
                      Comprobante
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-3.5 text-[15px]"
                      variant={dialogView === "form" ? "default" : "outline"}
                      onClick={() => setDialogView("form")}
                    >
                      <Pencil className="mr-1 h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                )}
                <ReportActions
                  className="gap-2 [&_button]:h-9 [&_button]:px-3.5 [&_button]:text-[15px]"
                  reportTitle={selectedEvento ? `Comprobante Evento #${selectedEvento.numeroLanzamiento}` : "Nuevo Evento"}
                  reportSummary={selectedEventoSummary}
                  imageTargetId={selectedEvento ? eventoReceiptTargetId : eventoPrintTargetId}
                  printTargetId={selectedEvento ? eventoReceiptTargetId : eventoPrintTargetId}
                  documentLabel={selectedEvento ? "Comprobante de Evento" : "Formulario de Evento"}
                  showDefaultFooter={!selectedEvento}
                />
              </div>
            </div>
          </DialogHeader>
          {dialogView === "form" && (
            <div id={eventoPrintTargetId} className={dialogPanelClassName}>
              <EventoForm evento={selectedEvento} onSave={handleSave} onCancel={closeForm} />
            </div>
          )}
          {selectedEvento && dialogView === "receipt" && (
            <div className={dialogPanelClassName}>
              <EventoComprobante
                evento={selectedEvento}
                parcela={selectedParcela}
                cultivo={selectedCultivo}
                zafra={selectedZafra}
              />
            </div>
          )}
          {selectedEvento && dialogView !== "receipt" && (
            <div id={eventoReceiptTargetId} className="report-export-only">
              <EventoComprobante
                evento={selectedEvento}
                parcela={selectedParcela}
                cultivo={selectedCultivo}
                zafra={selectedZafra}
              />
            </div>
          )}
          {selectedEvento && dialogView === "receipt" && (
            <div id={eventoReceiptTargetId} className="report-export-only">
              <EventoComprobante
                evento={selectedEvento}
                parcela={selectedParcela}
                cultivo={selectedCultivo}
                zafra={selectedZafra}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
