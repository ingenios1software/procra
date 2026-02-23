"use client"

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';
import { Sprout, AlertCircle, CheckCircle, Clock, CalendarDays, SprayCan } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Evento, Zafra, EtapaCultivo } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"


interface EventoAnalisisPanelProps {
  eventoActual: Partial<Evento>;
  todosLosEventos: Evento[];
  zafras: Zafra[];
  etapasCultivo: EtapaCultivo[];
}

const INTERVALO_RECOMENDADO: { [key: string]: { min: number; max: number } } = {
  aplicacion: { min: 15, max: 25 },
  fertilización: { min: 20, max: 30 },
  riego: { min: 5, max: 10 },
  default: { min: 15, max: 30 },
};

export function EventoAnalisisPanel({
  eventoActual,
  todosLosEventos,
  zafras,
  etapasCultivo
}: EventoAnalisisPanelProps) {

  const {
    diasDesdeSiembra,
    progresoZafra,
    etapaFisiologica,
    diasEnEtapa,
    proximaEtapa,
    diasParaProximaEtapa
  } = useMemo(() => {
    const zafra = zafras.find(z => z.id === eventoActual.zafraId);
    if (!zafra || !zafra.fechaSiembra) return { progresoZafra: 0 };

    const hoy = new Date();
    const diasDesdeSiembra = differenceInDays(hoy, new Date(zafra.fechaSiembra as string));
    
    const progreso = zafra.fechaFin ? Math.round((diasDesdeSiembra / differenceInDays(new Date(zafra.fechaFin as string), new Date(zafra.fechaSiembra as string))) * 100) : 0;
    
    const etapasDelCultivo = etapasCultivo
      .filter(e => e.cultivoId === zafra.cultivoId)
      .sort((a,b) => a.orden - b.orden);

    const etapaActual = etapasDelCultivo.find(e => diasDesdeSiembra >= e.diasDesdeSiembraInicio && diasDesdeSiembra <= e.diasDesdeSiembraFin);
    
    let diasEnEtapa, proximaEtapa, diasParaProximaEtapa;
    if (etapaActual) {
        diasEnEtapa = diasDesdeSiembra - etapaActual.diasDesdeSiembraInicio;
        const indexEtapaActual = etapasDelCultivo.findIndex(e => e.id === etapaActual.id);
        if (indexEtapaActual < etapasDelCultivo.length - 1) {
            proximaEtapa = etapasDelCultivo[indexEtapaActual + 1];
            diasParaProximaEtapa = proximaEtapa.diasDesdeSiembraInicio - diasDesdeSiembra;
        }
    }

    return {
      diasDesdeSiembra,
      progresoZafra: Math.min(100, progreso),
      etapaFisiologica: etapaActual?.nombre,
      diasEnEtapa,
      proximaEtapa: proximaEtapa?.nombre,
      diasParaProximaEtapa
    };
  }, [eventoActual.zafraId, zafras, etapasCultivo]);

  const { ultimoEventoSimilar, diasDesdeUltimoSimilar, intervaloStatus } = useMemo(() => {
    if (!eventoActual.parcelaId || !eventoActual.tipo) return {};
    
    const eventoFecha = eventoActual.fecha ? new Date(eventoActual.fecha) : new Date();

    const ultimo = todosLosEventos
      .filter(e => e.parcelaId === eventoActual.parcelaId && e.tipo === eventoActual.tipo && new Date(e.fecha) < eventoFecha)
      .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
      
    if (!ultimo) return {};

    const dias = differenceInDays(eventoFecha, new Date(ultimo.fecha));
    const recomendado = INTERVALO_RECOMENDADO[eventoActual.tipo] || INTERVALO_RECOMENDADO.default;

    let status: 'ok' | 'warn' | 'danger' = 'ok';
    if (dias < recomendado.min * 0.8 || dias > recomendado.max * 1.2) {
      status = 'danger';
    } else if (dias < recomendado.min || dias > recomendado.max) {
      status = 'warn';
    }
    
    return { ultimoEventoSimilar: ultimo, diasDesdeUltimoSimilar: dias, intervaloStatus: status };
  }, [eventoActual.parcelaId, eventoActual.tipo, eventoActual.fecha, todosLosEventos]);

  const { ultimaActividad, diasDesdeUltimaActividad, eventosUltimos30Dias } = useMemo(() => {
    if (!eventoActual.parcelaId) return {};

    const eventoFecha = eventoActual.fecha ? new Date(eventoActual.fecha) : new Date();

    const eventosParcela = todosLosEventos
      .filter(e => e.parcelaId === eventoActual.parcelaId && new Date(e.fecha) < eventoFecha)
      .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const ultima = eventosParcela[0];
    const dias = ultima ? differenceInDays(eventoFecha, new Date(ultima.fecha)) : null;

    const treintaDiasAtras = new Date(eventoFecha);
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
    const eventosRecientes = todosLosEventos.filter(e => e.parcelaId === eventoActual.parcelaId && new Date(e.fecha) > treintaDiasAtras && new Date(e.fecha) <= eventoFecha).length;

    return { ultimaActividad: ultima, diasDesdeUltimaActividad: dias, eventosUltimos30Dias: eventosRecientes };
  }, [eventoActual.parcelaId, eventoActual.fecha, todosLosEventos]);

  if (!eventoActual.parcelaId || !eventoActual.zafraId) {
    return (
      <Card className="mb-6 bg-muted/30 border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Seleccione una parcela y una zafra para ver el análisis agronómico.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <Sprout className="w-8 h-8 text-primary" />
          <CardTitle className="text-lg">Ciclo del Cultivo</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
          {diasDesdeSiembra !== undefined ? (
            <>
              <div className="text-sm"><span className="font-semibold">Días desde siembra:</span> {diasDesdeSiembra} días</div>
              <div className="text-sm"><span className="font-semibold">Etapa Fisiológica:</span> {etapaFisiologica || <span className="text-muted-foreground italic">No definida</span>}</div>
              {diasEnEtapa !== undefined && <div className="text-sm"><span className="font-semibold">Días en esta etapa:</span> {diasEnEtapa}</div>}
              {proximaEtapa && <div className="text-sm"><span className="font-semibold">Próxima etapa:</span> {proximaEtapa} (en ~{diasParaProximaEtapa} días)</div>}
              <div className="pt-2">
                <label className="text-sm font-medium">Progreso de la zafra: {progresoZafra}%</label>
                <Progress value={progresoZafra} className="h-2 mt-1" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No se encontró la fecha de siembra para esta zafra.</p>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <SprayCan className="w-8 h-8 text-primary" />
            <CardTitle className="text-lg">Intervalo entre Eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
           {ultimoEventoSimilar ? (
            <>
                <div className="text-sm">
                    <span className="font-semibold">Última aplicación similar:</span> {diasDesdeUltimoSimilar} días atrás
                </div>
                <div className="text-sm">
                    <span className="font-semibold">Intervalo recomendado:</span> {INTERVALO_RECOMENDADO[eventoActual.tipo!]?.min}-{INTERVALO_RECOMENDADO[eventoActual.tipo!]?.max} días
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Estado:</span>
                    {intervaloStatus === 'ok' && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/>En Rango</Badge>}
                    {intervaloStatus === 'warn' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3 mr-1"/>Advertencia</Badge>}
                    {intervaloStatus === 'danger' && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1"/>Fuera de Rango</Badge>}
                </div>
                 <div className="h-[60px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: 'intervalo', dias: diasDesdeUltimoSimilar }]} layout="vertical" margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                            <YAxis type="category" dataKey="name" hide />
                            <XAxis type="number" domain={[0, Math.max(30, diasDesdeUltimoSimilar || 0) + 5]} hide />
                            <Bar dataKey="dias" fill="hsl(var(--primary))" barSize={10} radius={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </>
           ) : (
            <p className="text-sm text-muted-foreground italic">Primera aplicación de este tipo en la parcela.</p>
           )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
         <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <CalendarDays className="w-8 h-8 text-primary" />
            <CardTitle className="text-lg">Historial de Actividad</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-3">
            {ultimaActividad ? (
                <>
                    <div className="text-sm"><span className="font-semibold">Última actividad:</span> {diasDesdeUltimaActividad} días atrás ({ultimaActividad.tipo})</div>
                     {diasDesdeUltimaActividad && diasDesdeUltimaActividad > 15 && (
                        <div className="flex items-center gap-2 text-sm text-amber-700 p-2 bg-amber-50 rounded-md">
                            <AlertCircle className="w-4 h-4"/>
                            <p>Más de 15 días sin actividad registrada.</p>
                        </div>
                    )}
                    <div className="text-sm"><span className="font-semibold">Eventos en los últimos 30 días:</span> {eventosUltimos30Dias}</div>
                </>
            ) : (
                <p className="text-sm text-muted-foreground italic">Sin eventos previos en esta parcela.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
