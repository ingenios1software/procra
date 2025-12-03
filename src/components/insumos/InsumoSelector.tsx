"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  PackageSearch,
  AlertCircle,
  X,
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
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
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
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollArea } from "../ui/scroll-area";

interface InsumoSelectorProps {
  value?: Insumo;
  onChange: (insumo?: Insumo) => void;
  disabled?: boolean;
}

function filtrarInsumos(insumos: Insumo[], query: string): Insumo[] {
  const q = query.toLowerCase().trim();
  if (!q) return insumos;

  return insumos.filter((ins) => {
    const nombre = ins.nombre?.toLowerCase() || "";
    const principio = ins.principioActivo?.toLowerCase() || "";
    const categoria = ins.categoria?.toLowerCase() || "";
    // const codigo = ins.codigo?.toLowerCase() || ""; // 'codigo' field does not exist on Insumo type
    const item = ins.numeroItem?.toString() || "";

    return (
      nombre.includes(q) ||
      principio.includes(q) ||
      categoria.includes(q) ||
      // codigo.includes(q) ||
      item.includes(q)
    );
  });
}


export function InsumoSelector({
  value,
  onChange,
  disabled,
}: InsumoSelectorProps) {
  const firestore = useFirestore();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | undefined>(value?.id);
  const isDesktop = useMediaQuery("(min-width: 768px)");


  const insumosQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "insumos"), orderBy("nombre")) : null),
    [firestore]
  );
  const { data: insumos, isLoading } = useCollection<Insumo>(insumosQuery);

  React.useEffect(() => {
    setSelectedId(value?.id);
  }, [value]);

  const { insumosFiltrados, gruposCategorias } = React.useMemo(() => {
    if (!insumos) {
      return { insumosFiltrados: [], gruposCategorias: [] };
    }

    const filtered = filtrarInsumos(insumos, searchQuery);

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
    setSelectedId(selected?.id);
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

  const selectorContent = (
    <Command>
      <CommandInput
        placeholder="Buscar por Nº, nombre, o principio activo..."
        onValueChange={setSearchQuery}
        className="text-base sm:text-sm h-12"
      />
      <ScrollArea className="flex-grow">
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
                heading={<span className="capitalize px-2 py-1.5 text-sm font-semibold">{categoria}</span>}
              >
                {insumosGrupo.map((insumo) => (
                  <CommandItem
                    key={insumo.id}
                    value={insumo.id}
                    onSelect={handleSelect}
                    className="py-3 px-3 text-base sm:text-sm"
                  >
                    <Check
                      className={cn(
                        "mr-3 h-5 w-5",
                        selectedId === insumo.id ? "opacity-100" : "opacity-0"
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
      </ScrollArea>
    </Command>
  );

  if (isDesktop) {
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
       {selectorContent}
      </PopoverContent>
    </Popover>
    );
  }

  return (
    <>
      <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto py-3 px-4 text-base sm:text-sm"
          disabled={disabled || isLoading}
          onClick={() => setOpen(true)}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-screen w-screen max-w-full rounded-none p-0 flex flex-col sm:h-auto sm:w-auto sm:max-w-2xl sm:rounded-lg">
            <div className="flex items-center justify-between border-b p-4">
                 <h2 className="text-lg font-semibold">Seleccionar Insumo</h2>
                 <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5"/></Button>
            </div>
            <div className="flex-grow overflow-hidden p-2">
                {selectorContent}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
