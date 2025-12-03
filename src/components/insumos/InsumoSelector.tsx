"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  PackageSearch,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Insumo } from "@/lib/types";
import { collection, orderBy, query } from "firebase/firestore";

interface InsumoSelectorProps {
  value?: Insumo;
  onChange: (insumo?: Insumo) => void;
  disabled?: boolean;
}

export function InsumoSelector({
  value,
  onChange,
  disabled,
}: InsumoSelectorProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const insumosQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "insumos")) : null),
    [firestore]
  );
  const { data: insumos, isLoading } = useCollection<Insumo>(insumosQuery);

  const { insumosFiltrados, gruposCategorias } = React.useMemo(() => {
    if (!insumos) {
      return { insumosFiltrados: [], gruposCategorias: [] };
    }

    let filtered = insumos;

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = insumos.filter(ins => {
            const byNumero = ins.numeroItem?.toString().toLowerCase().includes(q);
            const byNombre = ins.nombre.toLowerCase().includes(q);
            const byPrincipio = ins.principioActivo && ins.principioActivo.toLowerCase().includes(q);
            return byNumero || byNombre || byPrincipio;
        });
    }

    const grouped: Record<string, Insumo[]> = filtered.reduce((acc, ins) => {
      const categoria = ins.categoria || "otros";
      if (!acc[categoria]) {
        acc[categoria] = [];
      }
      acc[categoria].push(ins);
      return acc;
    }, {} as Record<string, Insumo[]>);
    
    // Ordenar los grupos
    const orderedGroups = Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0]));

    return {
      insumosFiltrados: filtered,
      gruposCategorias: orderedGroups,
    };
  }, [insumos, searchQuery]);

  const handleSelect = (currentValue: string) => {
    const selected = insumos?.find((insumo) => insumo.id === currentValue);
    onChange(selected);
    setOpen(false);
    setSearchQuery("");
  };

  const getStockIndicator = (insumo: Insumo) => {
    if (insumo.stockActual < insumo.stockMinimo) {
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (insumo.stockActual < insumo.stockMinimo * 1.2) {
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    return <div className="h-4 w-4" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto py-3 px-4 text-base sm:text-sm"
          disabled={disabled || isLoading}
        >
          <span className="truncate">
          {isLoading ? (
            "Cargando..."
          ) : value ? (
            `#${value.numeroItem} - ${value.nombre}`
          ) : (
            "Seleccionar insumo..."
          )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[80vh] sm:max-h-[60vh] p-0 flex flex-col">
        <Command>
          <CommandInput
            placeholder="Buscar por Nº, nombre, o principio activo..."
            onValueChange={setSearchQuery}
            className="text-base sm:text-sm h-12"
          />
          <CommandList className="flex-grow">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                Cargando insumos...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="p-4 text-center text-sm text-muted-foreground">
                     <PackageSearch className="mx-auto h-8 w-8 mb-2"/>
                    No se encontraron insumos.
                  </div>
                </CommandEmpty>
                {gruposCategorias.map(([categoria, insumosGrupo]) => (
                  <CommandGroup
                    key={categoria}
                    heading={<span className="capitalize px-2 py-1.5 text-sm font-semibold">{categoria}</span>}
                  >
                    {insumosGrupo.map((insumo) => (
                      <CommandItem
                        key={insumo.id}
                        value={insumo.id}
                        onSelect={handleSelect}
                        className="py-2 px-3 text-base sm:text-sm"
                      >
                        <Check
                          className={cn(
                            "mr-3 h-5 w-5",
                            value?.id === insumo.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col w-full">
                          <p className="font-semibold text-base sm:text-sm">
                            #{insumo.numeroItem} — {insumo.nombre}
                          </p>
                          <div className="flex justify-between items-center text-sm sm:text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                Stock: {insumo.stockActual?.toLocaleString() || 0} {insumo.unidad}
                                {getStockIndicator(insumo)}
                            </span>
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="font-mono">
                                            ${insumo.precioPromedioCalculado?.toLocaleString('en-US',{maximumFractionDigits: 2}) || 'N/A'}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Costo Promedio Calculado</p>
                                    </TooltipContent>
                                </Tooltip>
                             </TooltipProvider>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
