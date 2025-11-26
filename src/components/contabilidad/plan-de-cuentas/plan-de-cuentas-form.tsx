"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import type { PlanDeCuenta } from "@/lib/types";

const formSchema = z.object({
  codigo: z.string().min(1, "El código es requerido."),
  nombre: z.string().min(3, "El nombre es muy corto."),
  tipo: z.enum(["activo", "pasivo", "patrimonio", "ingreso", "costo", "gasto"], {
    required_error: "Debe seleccionar un tipo de cuenta.",
  }),
  naturaleza: z.enum(["deudora", "acreedora"], {
    required_error: "Debe seleccionar la naturaleza de la cuenta.",
  }),
});

type PlanDeCuentasFormValues = z.infer<typeof formSchema>;

interface PlanDeCuentasFormProps {
  cuenta?: PlanDeCuenta | null;
  onSubmit: (data: Omit<PlanDeCuenta, "id">) => void;
  onCancel: () => void;
}

export function PlanDeCuentasForm({
  cuenta,
  onSubmit,
  onCancel,
}: PlanDeCuentasFormProps) {
  const form = useForm<PlanDeCuentasFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: cuenta || {
      codigo: "",
      nombre: "",
      tipo: "gasto",
      naturaleza: "deudora",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="codigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <Input placeholder="1.01.01.001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de la Cuenta</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Caja Chica" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Cuenta</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="pasivo">Pasivo</SelectItem>
                    <SelectItem value="patrimonio">Patrimonio</SelectItem>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="costo">Costo</SelectItem>
                    <SelectItem value="gasto">Gasto</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="naturaleza"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Naturaleza</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una naturaleza" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="deudora">Deudora</SelectItem>
                    <SelectItem value="acreedora">Acreedora</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {cuenta ? "Guardar Cambios" : "Crear Cuenta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
