"use client";

import * as React from "react";
import {
  ChevronsUpDown,
  Loader2,
  PackageSearch,
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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Insumo } from "@/lib/types";
import { collection, orderBy, query } from "firebase/firestore";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollArea } from "../ui/scroll-area";
import { Input } from "../ui/input";
import { useToast } from "@/hooks/use-toast";

interface InsumoSelectorProps {
  value?: Insumo;
  onChange: (insumo?: Insumo) => void;
  disabled?: boolean;
}

function filtrarInsumos(insumos: Insumo[], query: string): Insumo[] {
  if (!query || query.trim() === "") return insumos;

  const q = query.toLowerCase().trim();

  return insumos.filter((ins) => {
    const nombre = ins.nombre?.toLowerCase() || "";
    const principio = ins.principioActivo?.toLowerCase() || "";
    const categoria = ins.categoria?.toLowerCase() || "";
    const item = ins.numeroItem?.toString() || "";

    return (
      nombre.includes(q) ||
      principio.includes(q) ||
      categoria.includes(q) ||
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
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [codigoQuery, setCodigoQuery] = React.useState(value?.numeroItem?.toString() || "");
  const isDesktop = useMediaQuery("(min-width: 768px)");


  const insumosQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "insumos"), orderBy("nombre")) : null),
    [firestore]
  );
  const { data: insumos, isLoading } = useCollection<Insumo>(insumosQuery);

  const { gruposCategorias, insumosMap } = React.useMemo(() => {
    if (!insumos) {
      return { gruposCategorias: [], insumosMap: new Map() };
    }

    const filtered = filtrarInsumos(insumos, searchQuery);
    const map = new Map(insumos.map(i => [i.numeroItem?.toString(), i]));


    const grouped: Record<string, Insumo[]> = filtered.reduce((acc, ins) => {
      const categoria = ins.categoria || "otros";
      if (!acc[categoria]) {
        acc[categoria] = [];
      }
      acc[categoria].push(ins);
      return acc;
    }, {} as Record<string, Insumo[]>);
    
    const orderedGroups = Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0]));

    return {
      gruposCategorias: orderedGroups,
      insumosMap: map,
    };
  }, [insumos, searchQuery]);

  const handleCodigoSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const found = insumosMap.get(codigoQuery);
      if (found) {
        onChange(found);
        setOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Insumo no encontrado",
          description: `No se encontró un insumo con el código #${codigoQuery}.`
        });
      }
    }
  }
  
  React.useEffect(() => {
    setCodigoQuery(value?.numeroItem?.toString() || "");
  }, [value]);


  const selectorContent = (
    <Command>
      <CommandInput
        placeholder="Buscar por nombre, o principio activo..."
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
                    value={`${insumo.numeroItem} ${insumo.nombre} ${insumo.principioActivo}`}
                    onSelect={() => {
                      onChange(insumo);
                      setOpen(false);
                      setSearchQuery("");
                      setCodigoQuery(insumo.numeroItem?.toString() || "");
                    }}
                    className="cursor-pointer"
                  >
                     <div className="flex flex-col w-full">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-base">#{insumo.numeroItem} — {insumo.nombre}</span>
                            <span className="text-xs bg-muted px-2 py-1 rounded-full">{insumo.unidad}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mt-1">
                            <span>Stock: {insumo.stockActual?.toLocaleString('en-US') || 0}</span>
                            <span>Precio: ${insumo.precioPromedioCalculado?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || 0}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            P.A: {insumo.principioActivo || '----'}
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

  const mainSelector = (
     <Popover open={open && isDesktop} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 text-base sm:text-sm"
          disabled={disabled || isLoading}
          onClick={() => isDesktop && setOpen(true)}
        >
          <span className="truncate">
          {isLoading ? (
            "Cargando..."
          ) : value ? (
            value.nombre
          ) : (
            "Seleccionar insumo..."
          )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {isDesktop && (
        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[80vh] sm:max-h-[60vh] p-0 flex flex-col">
         {selectorContent}
        </PopoverContent>
      )}
    </Popover>
  )

  if (isDesktop) {
    return (
      <div className="flex items-center gap-2">
        <Input 
          type="text" 
          placeholder="Código" 
          className="w-20 h-9"
          value={codigoQuery}
          onChange={(e) => setCodigoQuery(e.target.value)}
          onKeyDown={handleCodigoSearch}
          onBlur={() => codigoQuery !== value?.numeroItem?.toString() && handleCodigoSearch({key: 'Enter', preventDefault: ()=>{}} as any)}
          disabled={disabled || isLoading}
        />
        <div className="flex-grow">
          {mainSelector}
        </div>
      </div>
    );
  }

  // --- Mobile View ---
  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input 
            type="text" 
            placeholder="Código" 
            className="w-24 h-12 text-base"
            value={codigoQuery}
            onChange={(e) => setCodigoQuery(e.target.value)}
            onKeyDown={handleCodigoSearch}
            disabled={disabled || isLoading}
          />
          <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between h-12 text-base"
              disabled={disabled || isLoading}
              onClick={() => setOpen(true)}
            >
              <span className="truncate">
              {isLoading ? (
                "Cargando..."
              ) : value ? (
                value.nombre
              ) : (
                "Seleccionar..."
              )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </div>

      <Dialog open={open && !isDesktop} onOpenChange={setOpen}>
        <DialogContent className="h-screen w-screen max-w-full rounded-none p-0 flex flex-col sm:h-auto sm:w-auto sm:max-w-2xl sm:rounded-lg">
            <DialogHeader className="flex-row items-center justify-between border-b p-4">
                 <DialogTitle className="text-lg font-semibold">Seleccionar Insumo</DialogTitle>
                 <Button variant="ghost" size="icon" onClick={() => {setOpen(false); setSearchQuery("")}}><X className="h-5 w-5"/></Button>
            </DialogHeader>
            <div className="flex-grow overflow-hidden p-2">
                {selectorContent}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
