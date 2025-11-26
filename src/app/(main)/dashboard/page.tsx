import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockEventos, mockParcelas } from "@/lib/mock-data";
import { Activity, Map, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const totalParcelas = mockParcelas.length;
  const totalEventos = mockEventos.length;
  const recentEvents = mockEventos.slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" description="Bienvenido a CRApro95. Aquí tienes un resumen de tu actividad." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Parcelas
            </CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParcelas}</div>
            <p className="text-xs text-muted-foreground">
              Parcelas gestionadas en el sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eventos Registrados
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEventos}</div>
            <p className="text-xs text-muted-foreground">
              Eventos agrícolas registrados
            </p>
          </CardContent>
        </Card>
        <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximo Evento
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15 Días</div>
             <p className="text-xs text-muted-foreground">
              Para la próxima fertilización programada
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Últimos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((evento) => {
                  const parcela = mockParcelas.find(p => p.id === evento.parcelaId);
                  return (
                    <TableRow key={evento.id}>
                      <TableCell>{format(evento.fecha, "dd/MM/yyyy")}</TableCell>
                      <TableCell>{parcela?.nombre || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{evento.tipo}</Badge>
                      </TableCell>
                      <TableCell>{evento.descripcion}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
