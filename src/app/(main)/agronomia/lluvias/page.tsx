"use client";

import { useMemo, useState } from "react";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useCollection,
  useMemoFirebase,
  useUser,
} from "@/firebase";
import { getDocs, limit, orderBy, query, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ReportActions } from "@/components/shared/report-actions";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { LluviaSectorForm } from "@/components/agronomia/lluvias/lluvia-sector-form";
import {
  buildLluviaDistribuidaPorParcelaZafra,
  getSectoresDisponibles,
  normalizeSectorName,
  sanitizeRegistroLluviaSectorDraft,
} from "@/lib/lluvias";
import type { Parcela, RegistroLluviaSector, Zafra } from "@/lib/types";

type LluviaSectorFormInput = {
  zafraId: string;
  fecha: Date;
  sector: string;
  milimetros: number;
  observacion?: string;
};

const ZAFRA_FILTER_ALL = "all";

export default function LluviasSectorPage() {
  const tenant = useTenantFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const lluviasQuery = useMemoFirebase(
    () => tenant.query("lluviasSector", orderBy("fecha", "desc")),
    [tenant]
  );
  const { data: registros, isLoading: isLoadingRegistros } =
    useCollection<RegistroLluviaSector>(lluviasQuery);

  const parcelasQuery = useMemoFirebase(
    () => tenant.query("parcelas", orderBy("nombre")),
    [tenant]
  );
  const { data: parcelas, isLoading: isLoadingParcelas } =
    useCollection<Parcela>(parcelasQuery);

  const zafrasQuery = useMemoFirebase(
    () => tenant.query("zafras", orderBy("nombre")),
    [tenant]
  );
  const { data: zafras, isLoading: isLoadingZafras } =
    useCollection<Zafra>(zafrasQuery);

  const [selectedRegistro, setSelectedRegistro] =
    useState<RegistroLluviaSector | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [selectedZafraId, setSelectedZafraId] = useState(ZAFRA_FILTER_ALL);
  const [sectorFilter, setSectorFilter] = useState("");

  const sectoresDisponibles = useMemo(
    () => getSectoresDisponibles(parcelas || []),
    [parcelas]
  );

  const parcelasPorSector = useMemo(() => {
    const map = new Map<string, Parcela[]>();

    (parcelas || []).forEach((parcela) => {
      const sectorNormalizado = normalizeSectorName(parcela.sector);
      if (!sectorNormalizado) return;

      const existing = map.get(sectorNormalizado) || [];
      existing.push(parcela);
      map.set(sectorNormalizado, existing);
    });

    return map;
  }, [parcelas]);

  const registrosFiltrados = useMemo(() => {
    return (registros || []).filter((registro) => {
      const matchesZafra =
        selectedZafraId === ZAFRA_FILTER_ALL || registro.zafraId === selectedZafraId;
      const matchesSector = normalizeSectorName(registro.sector).includes(
        normalizeSectorName(sectorFilter)
      );
      return matchesZafra && matchesSector;
    });
  }, [registros, sectorFilter, selectedZafraId]);

  const distribucionFiltrada = useMemo(
    () => buildLluviaDistribuidaPorParcelaZafra(parcelas || [], registrosFiltrados),
    [parcelas, registrosFiltrados]
  );

  const resumen = useMemo(() => {
    const totalRegistros = registrosFiltrados.length;
    const totalMilimetros = registrosFiltrados.reduce(
      (sum, registro) => sum + (Number(registro.milimetros) || 0),
      0
    );
    const sectoresConRegistros = new Set(
      registrosFiltrados.map((registro) => normalizeSectorName(registro.sector)).filter(Boolean)
    ).size;
    const parcelasImpactadas = new Set(
      distribucionFiltrada.map((item) => item.parcelaId)
    ).size;

    return {
      totalRegistros,
      totalMilimetros,
      sectoresConRegistros,
      parcelasImpactadas,
    };
  }, [distribucionFiltrada, registrosFiltrados]);

  const shareSummary = `Registros: ${resumen.totalRegistros} | Milimetros: ${resumen.totalMilimetros.toLocaleString(
    "de-DE",
    { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  )} | Parcelas impactadas: ${resumen.parcelasImpactadas}.`;

  const openForm = (registro?: RegistroLluviaSector) => {
    setSelectedRegistro(registro || null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setSelectedRegistro(null);
    setFormOpen(false);
  };

  const handleSave = async (data: LluviaSectorFormInput) => {
    const lluviasCol = tenant.collection("lluviasSector");
    if (!lluviasCol) return;

    const zafra = (zafras || []).find((item) => item.id === data.zafraId);
    const sanitizedData = sanitizeRegistroLluviaSectorDraft({
      ...data,
      fecha: data.fecha.toISOString(),
      zafraNombre: zafra?.nombre || null,
    });

    const payload = {
      ...sanitizedData,
      sectorNormalizado: normalizeSectorName(sanitizedData.sector),
      actualizadoEn: serverTimestamp(),
    };

    if (selectedRegistro) {
      const registroRef = tenant.doc("lluviasSector", selectedRegistro.id);
      if (!registroRef) return;

      updateDocumentNonBlocking(registroRef, payload);
      toast({
        title: "Registro actualizado",
        description: `La lluvia del sector ${sanitizedData.sector} fue actualizada.`,
      });
      closeForm();
      return;
    }

    const lastRecordQuery = query(lluviasCol, orderBy("numeroItem", "desc"), limit(1));
    const snapshot = await getDocs(lastRecordQuery);
    const maxNumeroItem = snapshot.docs[0]?.data()?.numeroItem || 0;
    const numeroItem = maxNumeroItem + 1;

    addDocumentNonBlocking(lluviasCol, {
      ...payload,
      numeroItem,
      creadoPor: user?.displayName || user?.email || null,
      creadoEn: serverTimestamp(),
    });

    toast({
      title: "Lluvia registrada",
      description: `Se registraron ${sanitizedData.milimetros} mm para el sector ${sanitizedData.sector}.`,
    });
    closeForm();
  };

  const handleDelete = (id: string) => {
    const registro = (registros || []).find((item) => item.id === id);
    const registroRef = tenant.doc("lluviasSector", id);
    if (!registroRef) return;

    deleteDocumentNonBlocking(registroRef);
    toast({
      variant: "destructive",
      title: "Registro eliminado",
      description: `Se eliminó la lluvia del sector ${registro?.sector || "-"}.`,
    });
  };

  const isLoading = isLoadingRegistros || isLoadingParcelas || isLoadingZafras;

  return (
    <>
      <PageHeader
        title="Registro de Lluvias por Sector"
        description="Cargue lluvias por sector y distribuyalas automaticamente a las parcelas del mismo sector para analizar su impacto por zafra."
      >
        <ReportActions
          reportTitle="Registro de Lluvias por Sector"
          reportSummary={shareSummary}
        />
        {user && (
          <Button onClick={() => openForm()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Lluvia
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.totalRegistros}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Milimetros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {resumen.totalMilimetros.toLocaleString("de-DE", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              mm
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sectores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.sectoresConRegistros}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Parcelas impactadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.parcelasImpactadas}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4">
          <CardTitle>Listado de Lluvias</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Filtrar por sector..."
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              list="sectores-lluvias-filtro"
            />
            <datalist id="sectores-lluvias-filtro">
              {sectoresDisponibles.map((sector) => (
                <option key={sector} value={sector} />
              ))}
            </datalist>
            <Select value={selectedZafraId} onValueChange={setSelectedZafraId}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por zafra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ZAFRA_FILTER_ALL}>Todas las zafras</SelectItem>
                {(zafras || []).map((zafra) => (
                  <SelectItem key={zafra.id} value={zafra.id}>
                    {zafra.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table resizable className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Zafra</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Milimetros</TableHead>
                <TableHead>Parcelas alcanzadas</TableHead>
                <TableHead>Observacion</TableHead>
                {user && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={user ? 7 : 6} className="h-24 text-center">
                    Cargando registros...
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                registrosFiltrados.map((registro) => {
                  const parcelasDelSector =
                    parcelasPorSector.get(normalizeSectorName(registro.sector)) || [];

                  return (
                    <TableRow key={registro.id}>
                      <TableCell>
                        {new Date(registro.fecha as string).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{registro.zafraNombre || "-"}</TableCell>
                      <TableCell className="font-medium">{registro.sector}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(registro.milimetros || 0).toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{" "}
                        mm
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={parcelasDelSector.length > 0 ? "secondary" : "outline"}
                          title={parcelasDelSector.map((parcela) => parcela.nombre).join(", ")}
                        >
                          {parcelasDelSector.length} parcela(s)
                        </Badge>
                      </TableCell>
                      <TableCell>{registro.observacion || "-"}</TableCell>
                      {user && (
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
                              <DropdownMenuItem onClick={() => openForm(registro)}>
                                Editar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={(event) => event.preventDefault()}
                                  >
                                    Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Eliminar registro de lluvia
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta accion quitara los milimetros distribuidos a las
                                      parcelas del sector {registro.sector}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(registro.id)}
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

              {!isLoading && registrosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={user ? 7 : 6} className="h-24 text-center">
                    No hay registros de lluvia para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        modal={false}
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
            return;
          }

          setFormOpen(true);
        }}
      >
        <DialogContent draggable className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {selectedRegistro ? "Editar Lluvia" : "Registrar Lluvia por Sector"}
            </DialogTitle>
            <DialogDescription>
              Cada registro se distribuye automaticamente a las parcelas que
              pertenezcan al sector indicado.
            </DialogDescription>
          </DialogHeader>
          <LluviaSectorForm
            key={`${selectedRegistro?.id || "nueva-lluvia"}-${isFormOpen ? "abierto" : "cerrado"}`}
            registro={selectedRegistro}
            parcelas={parcelas || []}
            zafras={zafras || []}
            onSubmit={handleSave}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
