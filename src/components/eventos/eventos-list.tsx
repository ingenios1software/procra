"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { Evento, Parcela, Zafra } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface EventosListProps {
  initialEventos: Evento[];
  parcelas: Parcela[];
  zafras: Zafra[];
}

export function EventosList({ initialEventos, parcelas, zafras }: EventosListProps) {
  const { role } = useAuth();
  const canModify = role === 'admin' || role === 'operador';

  const [filters, setFilters] = useState({
    tipo: '',
    parcelaId: '',
    zafraId: ''
  });

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const filteredEventos = useMemo(() => {
    return initialEventos.filter(evento => {
      return (
        (filters.tipo ? evento.tipo === filters.tipo : true) &&
        (filters.parcelaId ? evento.parcelaId === filters.parcelaId : true) &&
        (filters.zafraId ? evento.zafraId === filters.zafraId : true)
      );
    });
  }, [initialEventos, filters]);

  const eventTypes = [...new Set(initialEventos.map(e => e.tipo))];

  return (
    <>
      <PageHeader
        title="Eventos"
        description="Registre y consulte todas las actividades agrícolas."
      >
        {canModify && (
          <Button asChild>
            <Link href="/eventos/crear">
              <PlusCircle className="mr-2 h-4 w-4" />
              Registrar Evento
            </Link>
          </Button>
        )}
      </PageHeader>
      
      <Card>
        <CardContent>
          <div className="flex items-center gap-4 py-4">
            <Select value={filters.tipo} onValueChange={(value) => handleFilterChange('tipo', value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los tipos</SelectItem>
                {eventTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.parcelaId} onValueChange={(value) => handleFilterChange('parcelaId', value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por parcela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las parcelas</SelectItem>
                {parcelas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.zafraId} onValueChange={(value) => handleFilterChange('zafraId', value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por zafra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las zafras</SelectItem>
                {zafras.map(z => <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                {canModify && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEventos.map((evento) => {
                const parcela = parcelas.find(p => p.id === evento.parcelaId);
                return (
                  <TableRow key={evento.id}>
                    <TableCell>{format(evento.fecha, "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{parcela?.nombre || 'N/A'}</TableCell>
                    <TableCell><Badge variant="outline">{evento.tipo}</Badge></TableCell>
                    <TableCell>{evento.descripcion}</TableCell>
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
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
