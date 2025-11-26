"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, PlusCircle, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CostoForm } from "./costo-form";
import type { Costo, Parcela, Zafra, Cultivo } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface CostosListProps {
  initialCostos: Costo[];
  parcelas: Parcela[];
  zafras: Zafra[];
  cultivos: Cultivo[];
}

export function CostosList({ initialCostos, parcelas, zafras, cultivos }: CostosListProps) {
  const [costos, setCostos] = useState(initialCostos);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedCosto, setSelectedCosto] = useState<Costo | null>(null);
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'gerente';

  const totalCostos = useMemo(() => {
    return costos.reduce((acc, costo) => acc + costo.monto, 0);
  }, [costos]);

  const handleSave = (costoData: Costo) => {
    if (selectedCosto) {
      setCostos(prev => prev.map(c => c.id === costoData.id ? costoData : c));
    } else {
      setCostos(prev => [...prev, { ...costoData, id: `cost${prev.length + 1}` }]);
    }
    setDialogOpen(false);
    setSelectedCosto(null);
  };
  
  const openDialog = (costo?: Costo) => {
    setSelectedCosto(costo || null);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Gestión de Costos"
        description="Registre y supervise todos los costos operativos y financieros."
      >
        {canModify && (
          <Button onClick={() => openDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Costo
          </Button>
        )}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total del Sistema</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCostos.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Suma de todos los costos registrados</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Listado de Costos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {costos.map((costo) => {
                const parcela = parcelas.find(p => p.id === costo.parcelaId);
                return (
                  <TableRow key={costo.id}>
                    <TableCell>{format(costo.fecha, "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{costo.descripcion}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{costo.tipo}</Badge></TableCell>
                    <TableCell>{parcela?.nombre || 'N/A'}</TableCell>
                    <TableCell className="text-right">${costo.monto.toLocaleString('es-AR')}</TableCell>
                    {canModify && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0" onClick={() => openDialog(costo)}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCosto ? 'Editar Costo' : 'Registrar Nuevo Costo'}</DialogTitle>
          </DialogHeader>
          <CostoForm
            costo={selectedCosto}
            onSubmit={handleSave}
            onCancel={() => setDialogOpen(false)}
            parcelas={parcelas}
            cultivos={cultivos}
            zafras={zafras}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
