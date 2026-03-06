"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Insumo } from "@/lib/types";
import React, { useMemo, useState } from "react";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";

const DEFAULT_CATEGORIES = [
  "semilla",
  "fertilizante",
  "herbicida",
  "fungicida",
  "insecticida",
  "combustible",
  "biologico",
  "otros",
] as const;

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  codigo: z.string().nonempty("El codigo es requerido."),
  descripcion: z.string().nonempty("La descripcion es requerida."),
  categoria: z.string().trim().min(1, "La categoria es requerida."),
  principioActivo: z.string().optional(),
  unidad: z.enum(["kg", "lt", "unidad", "ton"]),
  iva: z.enum(["0", "5", "10"]),
  precioVenta: z.coerce.number().min(0, "El precio de venta no puede ser negativo."),
  dosisRecomendada: z.coerce.number().optional(),
  stockMinimo: z.coerce.number().min(0, "El stock minimo no puede ser negativo."),
  proveedor: z.string().optional(),
  controlaLotes: z.boolean().default(false),
  permiteMovimientoSinLote: z.boolean().default(true),
  controlaVencimiento: z.boolean().default(false),
  permiteLoteSinVencimiento: z.boolean().default(true),
  diasAlertaVencimiento: z.coerce.number().min(1).max(365).default(30),
});

type InsumoFormValues = z.infer<typeof formSchema>;

interface InsumoFormProps {
  insumo?: Partial<Insumo> | null;
  existingCategories?: string[];
  onSubmit: (data: InsumoFormValues) => void;
  onCancel: () => void;
}

const normalizeCategory = (value: string) => value.trim().toLowerCase();

export const InsumoForm = React.memo(({ insumo, existingCategories = [], onSubmit, onCancel }: InsumoFormProps) => {
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [addedCategories, setAddedCategories] = useState<string[]>([]);

  const form = useForm<InsumoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: insumo
      ? {
          ...insumo,
          categoria: insumo.categoria || "otros",
          dosisRecomendada: insumo.dosisRecomendada || undefined,
          stockMinimo: insumo.stockMinimo || 0,
          proveedor: insumo.proveedor || "",
          iva: insumo.iva || "10",
          codigo: insumo.codigo || "",
          descripcion: insumo.descripcion || "",
          precioVenta: insumo.precioVenta || 0,
          controlaLotes: insumo.controlaLotes || false,
          permiteMovimientoSinLote: insumo.permiteMovimientoSinLote ?? true,
          controlaVencimiento: insumo.controlaVencimiento || false,
          permiteLoteSinVencimiento: insumo.permiteLoteSinVencimiento ?? true,
          diasAlertaVencimiento: insumo.diasAlertaVencimiento || 30,
        }
      : {
          nombre: "",
          codigo: "",
          descripcion: "",
          categoria: "otros",
          principioActivo: "",
          unidad: "unidad",
          iva: "10",
          precioVenta: 0,
          dosisRecomendada: 0,
          stockMinimo: 0,
          proveedor: "",
          controlaLotes: false,
          permiteMovimientoSinLote: true,
          controlaVencimiento: false,
          permiteLoteSinVencimiento: true,
          diasAlertaVencimiento: 30,
        },
  });

  const categoriaValue = useWatch({ control: form.control, name: "categoria" });
  const baseCategories = useMemo(() => {
    const all = [...DEFAULT_CATEGORIES, ...existingCategories, ...addedCategories]
      .map((cat) => normalizeCategory(cat))
      .filter(Boolean);
    return [...new Set(all)];
  }, [existingCategories, addedCategories]);

  const categorySuggestions = useMemo(() => {
    const current = normalizeCategory(categoriaValue || "");
    if (!current) return baseCategories;
    return baseCategories.includes(current) ? baseCategories : [...baseCategories, current];
  }, [categoriaValue, baseCategories]);

  const handleAddCategory = () => {
    const normalized = normalizeCategory(newCategoryDraft);
    if (!normalized) return;
    if (!categorySuggestions.includes(normalized)) {
      setAddedCategories((prev) => [...prev, normalized]);
    }
    form.setValue("categoria", normalized, { shouldValidate: true, shouldDirty: true });
    setNewCategoryDraft("");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Insumo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Urea" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Codigo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: FERT-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripcion</FormLabel>
                <FormControl>
                  <Textarea className="min-h-[110px]" placeholder="Descripcion detallada del producto..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoria"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl>
                  <Input
                    list="insumo-categorias"
                    placeholder="Ej: fertilizante"
                    {...field}
                    onChange={(event) => field.onChange(normalizeCategory(event.target.value))}
                  />
                </FormControl>
                <datalist id="insumo-categorias">
                  {categorySuggestions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={newCategoryDraft}
                    onChange={(event) => setNewCategoryDraft(event.target.value)}
                    placeholder="Agregar nueva categoria..."
                  />
                  <Button type="button" variant="outline" onClick={handleAddCategory}>
                    Agregar
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="principioActivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Principio Activo</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Glifosato" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="proveedor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proveedor (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="AgroPro S.A." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            control={form.control}
            name="unidad"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidad de Medida</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una unidad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramo (kg)</SelectItem>
                    <SelectItem value="lt">Litro (lt)</SelectItem>
                    <SelectItem value="ton">Tonelada (ton)</SelectItem>
                    <SelectItem value="unidad">Unidad</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="iva"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de IVA</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione IVA" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="0">Exento (0%)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dosisRecomendada"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dosis Recomendada (/ha)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ej: 2.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            control={form.control}
            name="stockMinimo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Minimo</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="precioVenta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio de Venta ($)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="25.50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="controlaLotes"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Controlar lotes para este insumo</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="permiteMovimientoSinLote"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Permitir movimientos sin lote</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="controlaVencimiento"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Controlar fecha de vencimiento</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="permiteLoteSinVencimiento"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Permitir lote sin vencimiento</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="diasAlertaVencimiento"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Dias para alerta de vencimiento</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={365} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">{insumo?.id ? "Guardar Cambios" : "Crear Insumo"}</Button>
        </div>
      </form>
    </Form>
  );
});

InsumoForm.displayName = "InsumoForm";
