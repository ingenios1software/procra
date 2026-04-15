"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Filter, Layers3, Sprout, X } from "lucide-react";

export type ParcelaSelectorOption = {
  id: string;
  nombre: string;
  superficie: number;
  isClosed: boolean;
};

interface PanelParcelaSelectorProps {
  disabled?: boolean;
  options: ParcelaSelectorOption[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

function formatSurface(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function buildTriggerLabel(options: ParcelaSelectorOption[], selectedIds: string[]) {
  if (options.length === 0) return "Sin parcelas";
  if (selectedIds.length === 0) return "Seleccionar parcelas";

  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  if (selectedOptions.length === 0) return "Seleccionar parcelas";
  if (selectedOptions.length === options.length) {
    return options.length === 1 ? selectedOptions[0].nombre : `Todas las parcelas (${options.length})`;
  }
  if (selectedOptions.length <= 2) {
    return selectedOptions.map((option) => option.nombre).join(", ");
  }

  return `${selectedOptions[0].nombre} + ${selectedOptions.length - 1} mas`;
}

export function PanelParcelaSelector({
  disabled,
  options,
  selectedIds,
  onSelectionChange,
}: PanelParcelaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return options;

    return options.filter((option) => {
      const haystack = `${option.nombre} ${option.isClosed ? "cerrada" : "abierta"}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [normalizedSearch, options]);

  const optionIds = useMemo(() => options.map((option) => option.id), [options]);
  const closedIds = useMemo(
    () => options.filter((option) => option.isClosed).map((option) => option.id),
    [options]
  );
  const openIds = useMemo(
    () => options.filter((option) => !option.isClosed).map((option) => option.id),
    [options]
  );

  const selectedCount = selectedIds.length;
  const selectedClosedCount = useMemo(
    () => options.filter((option) => option.isClosed && selectedIds.includes(option.id)).length,
    [options, selectedIds]
  );
  const selectedOpenCount = selectedCount - selectedClosedCount;
  const triggerLabel = useMemo(() => buildTriggerLabel(options, selectedIds), [options, selectedIds]);

  const applySelection = (ids: string[]) => {
    const uniqueIds = new Set(ids);
    const normalizedIds = optionIds.filter((id) => uniqueIds.has(id));
    onSelectionChange(normalizedIds);
  };

  const toggleSelection = (parcelaId: string) => {
    if (selectedIds.includes(parcelaId)) {
      applySelection(selectedIds.filter((id) => id !== parcelaId));
      return;
    }

    applySelection([...selectedIds, parcelaId]);
  };

  const totalSurface = useMemo(
    () =>
      options
        .filter((option) => selectedIds.includes(option.id))
        .reduce((total, option) => total + option.superficie, 0),
    [options, selectedIds]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          disabled={disabled || options.length === 0}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <div className="ml-3 flex items-center gap-2">
            {selectedCount > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {selectedCount}
              </span>
            ) : null}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="border-b p-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar parcela..."
            className="h-10 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-b p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => applySelection(optionIds)} disabled={optionIds.length === 0}>
            <Layers3 className="mr-2 h-4 w-4" />
            Todas
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applySelection(closedIds)} disabled={closedIds.length === 0}>
            <Filter className="mr-2 h-4 w-4" />
            Cerradas
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applySelection(openIds)} disabled={openIds.length === 0}>
            <Sprout className="mr-2 h-4 w-4" />
            Abiertas
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applySelection([])} disabled={selectedCount === 0}>
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </div>

        <ScrollArea className="h-72">
          <div className="p-2">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No hay parcelas que coincidan con el filtro.
              </div>
            ) : (
              filteredOptions.map((option) => {
                const checked = selectedIds.includes(option.id);

                return (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    onClick={() => toggleSelection(option.id)}
                  >
                    <Checkbox checked={checked} className="mt-1 pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{option.nombre}</span>
                        <span
                          className={
                            option.isClosed
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                              : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                          }
                        >
                          {option.isClosed ? "Cerrada" : "Abierta"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatSurface(option.superficie)} ha</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-3 text-xs text-muted-foreground">
          <span>{selectedCount} seleccionadas</span>
          <span>{selectedClosedCount} cerradas</span>
          <span>{selectedOpenCount} abiertas</span>
          <span>{formatSurface(totalSurface)} ha</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
