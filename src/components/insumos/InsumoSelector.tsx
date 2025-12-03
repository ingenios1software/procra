"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  PackageSearch,
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
            const byNumero = ins.numeroItem?.toString().includes(q);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : value ? (
            `#${value.numeroItem} - ${value.nombre}`
          ) : (
            "Seleccionar insumo..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Buscar por Nº, nombre, o principio activo..."
            onValueChange={setSearchQuery}
          />
          <CommandList>
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
                    heading={<span className="capitalize">{categoria}</span>}
                  >
                    {insumosGrupo.map((insumo) => (
                      <CommandItem
                        key={insumo.id}
                        value={insumo.id}
                        onSelect={handleSelect}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value?.id === insumo.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col w-full">
                          <p className="font-semibold">
                            #{insumo.numeroItem} — {insumo.nombre}
                          </p>
                          <div className="flex justify-between text-xs text-muted-foreground">
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            Stock: {insumo.stockActual?.toLocaleString() || 0} {insumo.unidad}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Costo Promedio: ${insumo.precioPromedioCalculado?.toLocaleString('en-US',{maximumFractionDigits: 2}) || 'N/A'}</p>
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