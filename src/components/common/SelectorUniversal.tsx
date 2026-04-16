"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, PackageSearch, X } from "lucide-react";
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
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "../ui/badge";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";
import { LEGACY_TENANT_COLLECTIONS } from "@/lib/tenant";

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
  itemFilter?: (item: T) => boolean;
  autoFocus?: boolean;
  onAutoFocusApplied?: () => void;
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
  itemFilter,
  autoFocus = false,
  onAutoFocusApplied,
}: SelectorUniversalProps<T>) {
  const firestore = useFirestore();
  const tenant = useTenantFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [codeQuery, setCodeQuery] = React.useState<string>((value?.[codeField] as string) || "");
  const triggerButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const autoFocusDoneRef = React.useRef(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isTenantCollection = LEGACY_TENANT_COLLECTIONS.includes(collectionName as (typeof LEGACY_TENANT_COLLECTIONS)[number]);

  const collectionRef = React.useMemo(() => {
    if (isTenantCollection) return tenant.collection(collectionName);
    return firestore ? collection(firestore, collectionName) : null;
  }, [collectionName, firestore, isTenantCollection, tenant]);

  const itemsQuery = useMemoFirebase(() => {
    if (!collectionRef) return null;
    return query(collectionRef);
  }, [collectionRef]);

  const { data: allItems, isLoading } = useCollection<T>(itemsQuery);

  const selectedItem = React.useMemo(() => {
    if (!value) return undefined;
    if (!allItems || allItems.length === 0) return value;
    return allItems.find((item) => item.id === value.id) || value;
  }, [allItems, value]);

  const baseItems = React.useMemo(() => {
    if (!allItems) return [] as T[];
    return itemFilter ? allItems.filter(itemFilter) : allItems;
  }, [allItems, itemFilter]);

  const filteredItems = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return baseItems;

    return baseItems.filter((item) =>
      searchFields.some((field) => {
        const fieldValue = item[field] as unknown;
        return fieldValue?.toString().toLowerCase().includes(q);
      })
    );
  }, [baseItems, searchFields, searchQuery]);

  const handleItemSelect = React.useCallback(
    (item: T) => {
      onSelect(item);
      const nextCode = item[codeField];
      setCodeQuery(nextCode !== undefined && nextCode !== null ? String(nextCode) : "");
      setSearchQuery("");
      setOpen(false);
    },
    [codeField, onSelect]
  );

  const renderHighlightedLabel = React.useCallback(
    (text: string) => {
      const q = searchQuery.trim();
      if (!q) return text;

      const textLower = text.toLowerCase();
      const qLower = q.toLowerCase();
      const start = textLower.indexOf(qLower);
      if (start < 0) return text;

      const end = start + q.length;
      return (
        <>
          {text.slice(0, start)}
          <span className="rounded bg-primary/15 px-0.5 text-foreground">
            {text.slice(start, end)}
          </span>
          {text.slice(end)}
        </>
      );
    },
    [searchQuery]
  );

  const handleCodeSearch = React.useCallback(async () => {
    const trimmedCodeQuery = String(codeQuery).trim();
    if (!trimmedCodeQuery) return;
    if (!collectionRef) return;

    const normalizedCodeQuery = trimmedCodeQuery.toLowerCase();
    const numericCode = Number(trimmedCodeQuery);
    const hasNumericVariant = !Number.isNaN(numericCode);

    const localItem = baseItems.find((item) => {
      const fieldValue = item[codeField] as unknown;
      if (fieldValue === undefined || fieldValue === null) return false;

      if (String(fieldValue).trim().toLowerCase() === normalizedCodeQuery) return true;
      return typeof fieldValue === "number" && hasNumericVariant && fieldValue === numericCode;
    });

    if (localItem) {
      handleItemSelect(localItem);
      return;
    }

    const candidateQueryValues: Array<string | number> = hasNumericVariant
      ? [numericCode, trimmedCodeQuery]
      : [trimmedCodeQuery];
    const attemptedValues = new Set<string>();

    for (const queryValue of candidateQueryValues) {
      const queryKey = `${typeof queryValue}:${String(queryValue)}`;
      if (attemptedValues.has(queryKey)) continue;
      attemptedValues.add(queryKey);

      const codeQueryRef = query(collectionRef, where(codeField as string, "==", queryValue), limit(1));
      const querySnapshot = await getDocs(codeQueryRef);

      if (querySnapshot.empty) continue;

      const foundDoc = querySnapshot.docs[0];
      const foundItem = { id: foundDoc.id, ...foundDoc.data() } as T;
      handleItemSelect(foundItem);
      return;
    }

    toast({
      variant: "destructive",
      title: "Registro no encontrado",
      description: `No se encontro un registro con el codigo "${trimmedCodeQuery}".`,
    });
  }, [baseItems, codeField, codeQuery, collectionRef, handleItemSelect, toast]);

  const handleCodeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      void handleCodeSearch();
    },
    [handleCodeSearch]
  );

  React.useEffect(() => {
    const nextCode = selectedItem?.[codeField];
    setCodeQuery(nextCode !== undefined && nextCode !== null ? String(nextCode) : "");
  }, [codeField, selectedItem]);

  React.useEffect(() => {
    if (!autoFocus || disabled || isLoading) {
      autoFocusDoneRef.current = false;
      return;
    }
    if (autoFocusDoneRef.current) return;

    const frameId = window.requestAnimationFrame(() => {
      const triggerButton = triggerButtonRef.current;
      if (!triggerButton) return;

      triggerButton.focus();
      triggerButton.scrollIntoView({ block: "nearest", inline: "nearest" });
      autoFocusDoneRef.current = true;
      onAutoFocusApplied?.();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [autoFocus, disabled, isLoading, onAutoFocusApplied]);

  const selectorContent = (
    <Command shouldFilter={false} loop>
      <CommandInput
        placeholder="Buscar por nombre o codigo..."
        onValueChange={setSearchQuery}
        className="h-12 text-base sm:text-sm"
      />
      <ScrollArea className="flex-grow">
        <CommandList>
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              Cargando...
            </div>
          ) : (
            <>
              <CommandEmpty>
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <PackageSearch className="mx-auto mb-2 h-8 w-8" />
                  No se encontraron resultados.
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${String(item[displayField] ?? "")} ${String(item[codeField] ?? "")} ${item.id}`}
                    onSelect={() => handleItemSelect(item)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => handleItemSelect(item)}
                    className="flex cursor-pointer flex-col items-start gap-1 rounded-md border border-transparent px-2 py-2 aria-selected:border-primary/30 aria-selected:bg-primary/10"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold">
                        {renderHighlightedLabel(String(item[displayField] ?? ""))}
                      </span>
                      <Badge variant="outline">{String(item[codeField] ?? "")}</Badge>
                    </div>
                    <div className="mt-1 grid w-full grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                      {extraInfoFields.map((info) => (
                        <div key={info.label} className="flex justify-between">
                          <span>{info.label}:</span>
                          <span className="font-medium">
                            {info.format
                              ? info.format(item[info.field])
                              : (item[info.field] as any)?.toString() || "N/A"}
                          </span>
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
      ref={triggerButtonRef}
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "h-9 min-w-0 max-w-full flex-grow justify-between text-base sm:text-sm",
        width
      )}
      disabled={isLoading || disabled}
    >
      <span className="truncate">
        {isLoading
          ? "Cargando..."
          : selectedItem
            ? String(selectedItem[displayField] ?? "")
            : label
              ? `Seleccionar ${label}...`
              : "Seleccionar..."}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isDesktop) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2">
        <Input
          type="text"
          placeholder="Cod."
          className="h-9 w-16 shrink-0"
          value={codeQuery || ""}
          onChange={(e) => setCodeQuery(e.target.value)}
          onKeyDown={handleCodeKeyDown}
          disabled={isLoading || disabled}
        />
        <div className="min-w-0 flex-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
            <PopoverContent className="flex max-w-[calc(100vw-2rem)] w-[var(--radix-popover-trigger-width)] flex-col p-0">
              {selectorContent}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Input
            type="text"
            placeholder="Codigo"
            className="h-12 w-24 shrink-0 text-base"
            value={codeQuery || ""}
            onChange={(e) => setCodeQuery(e.target.value)}
            onKeyDown={handleCodeKeyDown}
            disabled={isLoading || disabled}
          />
          <div
            onClick={() => !disabled && setOpen(true)}
            className="min-w-0 flex-grow"
          >
            {triggerButton}
          </div>
        </div>
      </div>
      <Dialog open={open && !isDesktop} onOpenChange={setOpen}>
        <DialogContent className="flex h-screen max-h-screen w-screen max-w-full flex-col rounded-none p-0 sm:h-[80vh] sm:max-h-[80vh] sm:w-auto sm:max-w-2xl sm:rounded-lg">
          <DialogHeader className="flex-row items-center justify-between border-b p-4">
            <DialogTitle className="text-lg font-semibold">Seleccionar {label}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
          <div className="flex-grow overflow-hidden p-2">{selectorContent}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
