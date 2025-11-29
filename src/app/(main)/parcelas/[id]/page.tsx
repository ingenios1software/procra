"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useDataStore } from "@/store/data-store";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MapPin, Code, Ruler, Activity } from "lucide-react";

export default function ParcelaDetailPage({ params }: { params: { id: string } }) {
  const { parcelas, eventos, cultivos } = useDataStore();
  const parcela = parcelas.find(p => p.id === params.id);
  
  if (!parcela) {
    notFound();
  }

  const eventosRelacionados = eventos.filter(e => e.parcelaId === parcela.id);

  return (
    <>
      <PageHeader
        title={parcela.nombre}
        description="Detalles de la parcela y su historial de eventos."
      />

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ubicación</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold">{parcela.ubicacion}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Superficie</CardTitle>
            <Ruler className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold">{parcela.superficie} ha</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg font-bold capitalize"><Badge>{parcela.estado}</Badge></div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cultivo</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventosRelacionados.length > 0 ? eventosRelacionados.map((evento) => {
                const cultivo = cultivos.find(c => c.id === evento.cultivoId);
                return (
                  <TableRow key={evento.id}>
                    <TableCell>{format(new Date(evento.fecha), "dd/MM/yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{evento.tipo}</Badge></TableCell>
                    <TableCell>{cultivo?.nombre || 'N/A'}</TableCell>
                    <TableCell>{evento.descripcion}</TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">No hay eventos registrados para esta parcela.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
