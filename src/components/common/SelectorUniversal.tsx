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
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

interface SelectorUniversalProps<T> {
  label?: string;
  collectionName: string;
  displayField: keyof T;
  codeField: keyof T;
  onSelect: (item: T | undefined) => void;
  value?: T & { id: string };
  width?: string;
  extraInfoFields?: { label: string; field: keyof T; format?: (value: any) => string }[];
  searchFields: (keyof T)[];
  disabled?: boolean;
}

export function SelectorUniversal<T extends { id: string }>({
  label,
  collectionName,
  displayField,
  codeField,
  onSelect,
  value,
  width = "w-full",
  extraInfoFields = [],
  searchFields = [],
  disabled = false,
}: SelectorUniversalProps<T>) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [codeQuery, setCodeQuery] = React.useState((value?.[codeField] as string) || "");

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, collectionName));
  }, [firestore, collectionName]);

  const { data: allItems, isLoading } = useCollection<T>(itemsQuery);

  const filteredItems = React.useMemo(() => {
    if (!allItems) return [];
    if (!debouncedSearchQuery) return allItems;

    const q = debouncedSearchQuery.toLowerCase().trim();

    return allItems.filter((item) => {
        return searchFields.some(field => {
            const fieldValue = item[field] as any;
            return fieldValue?.toString().toLowerCase().includes(q);
        })
    });
  }, [allItems, debouncedSearchQuery, searchFields]);


  const handleCodeSearch = async () => {
    if (!codeQuery.trim()) {
      onSelect(undefined);
      return;
    }
    if (!firestore) return;

    const numericCode = Number(codeQuery);
    if (isNaN(numericCode)) {
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: `El código "${codeQuery}" no es un número válido.`,
      });
      return;
    }

    const q = query(
      collection(firestore, collectionName),
      where(codeField as string, "==", numericCode),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const foundDoc = querySnapshot.docs[0];
      const foundItem = { id: foundDoc.id, ...foundDoc.data() } as T;
      onSelect(foundItem);
      setOpen(false);
    } else {
      toast({
        variant: "destructive",
        title: "Registro no encontrado",
        description: `No se encontró un registro con el código "${codeQuery}".`,
      });
      onSelect(undefined);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCodeSearch();
    }
  }


  React.useEffect(() => {
    setCodeQuery(value?.[codeField] as string || "");
  }, [value, codeField]);

  const selectorContent = (
    <Command>
      <CommandInput
        placeholder="Buscar por nombre o código..."
        onValueChange={setSearchQuery}
        className="text-base sm:text-sm h-12"
      />
      <ScrollArea className="flex-grow">
        <CommandList>
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" />Cargando...</div>
          ) : (
            <>
              <CommandEmpty><div className="p-4 text-center text-sm text-muted-foreground"><PackageSearch className="mx-auto h-8 w-8 mb-2"/>No se encontraron resultados.</div></CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item[displayField] as string}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    className="cursor-pointer flex flex-col items-start p-2"
                  >
                     <div className="flex justify-between w-full">
                        <span className="font-semibold">{item[displayField] as string}</span>
                        <span className="text-xs bg-muted px-2 py-1 rounded-full">{item[codeField] as string}</span>
                     </div>
                     <div className="text-xs text-muted-foreground mt-1 w-full grid grid-cols-2 gap-x-4">
                        {extraInfoFields.map(info => (
                            <div key={info.label} className="flex justify-between">
                                <span>{info.label}:</span>
                                <span className="font-medium">{info.format ? info.format(item[info.field]) : (item[info.field] as any)?.toString() || 'N/A'}</span>
                            </div>
                        ))}
                     </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </ScrollArea>
    </Command>
  );

  const triggerButton = (
     <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("justify-between h-9 text-base sm:text-sm", width, "flex-grow")}
        disabled={isLoading || disabled}
      >
        <span className="truncate">
          {isLoading ? "Cargando..." : value ? (value[displayField] as string) : `Seleccionar ${label}...`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
  )

  if (isDesktop) {
    return (
      <div className="flex items-center gap-2 w-full">
        <Input
          type="text"
          placeholder="Cod."
          className="w-16 h-9"
          value={codeQuery || ''}
          onChange={(e) => setCodeQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCodeSearch}
          disabled={isLoading || disabled}
        />
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="flex-grow">
                {triggerButton}
            </PopoverTrigger>
            <PopoverContent className="p-0 flex flex-col" style={{ width: `var(--radix-popover-trigger-width)`}}>
                {selectorContent}
            </PopoverContent>
        </Popover>
      </div>
    );
  }

  // --- Mobile View ---
  return (
    <>
      <div className="space-y-2">
         <div className="flex items-center gap-2">
            <Input type="text" placeholder="Código" className="w-24 h-12 text-base" value={codeQuery || ''} onChange={(e) => setCodeQuery(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleCodeSearch} disabled={isLoading || disabled} />
            <div onClick={() => !disabled && setOpen(true)} className="flex-grow">{triggerButton}</div>
        </div>
      </div>
      <Dialog open={open && !isDesktop} onOpenChange={setOpen}>
        <DialogContent className="h-screen w-screen max-w-full rounded-none p-0 flex flex-col sm:h-[80vh] sm:w-auto sm:max-w-2xl sm:rounded-lg">
            <DialogHeader className="flex-row items-center justify-between border-b p-4"><DialogTitle className="text-lg font-semibold">Seleccionar {label}</DialogTitle><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-5 w-5"/></Button></DialogHeader>
            <div className="flex-grow overflow-hidden p-2">{selectorContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
