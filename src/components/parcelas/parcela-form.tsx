"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { Parcela } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking, updateDocumentNonBlocking, useFirestore } from "@/firebase";
import { collection, doc, getCountFromServer } from "firebase/firestore";

const formSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
  codigo: z.string().min(2, "El código es muy corto."),
  superficie: z.coerce.number().positive("La superficie debe ser un número positivo."),
  ubicacion: z.string().min(5, "La ubicación es muy corta."),
  estado: z.enum(["activa", "inactiva", "en barbecho"]),
  sector: z.string().optional(),
});

type ParcelaFormValues = z.infer<typeof formSchema>;

interface ParcelaFormProps {
  parcela?: Parcela;
}

export function ParcelaForm({ parcela }: ParcelaFormProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ParcelaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: parcela || {
      nombre: "",
      codigo: "",
      superficie: 0,
      ubicacion: "",
      estado: "activa",
      sector: ""
    },
  });

  const handleSubmit = async (data: ParcelaFormValues) => {
    if(!firestore) return;

    if (parcela) {
      const parcelaRef = doc(firestore, 'parcelas', parcela.id);
      updateDocumentNonBlocking(parcelaRef, data);
      toast({ title: "Parcela actualizada", description: `La parcela ${data.nombre} ha sido actualizada.` });
    } else {
      const parcelasCol = collection(firestore, 'parcelas');
      const snapshot = await getCountFromServer(parcelasCol);
      const numeroItem = snapshot.data().count + 1;
      
      addDocumentNonBlocking(parcelasCol, { ...data, numeroItem });
      toast({ title: "Parcela creada", description: `La parcela ${data.nombre} (Item Nº ${numeroItem}) ha sido creada.` });
    }
    router.push('/parcelas');
    router.refresh(); // To ensure the list is updated
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Parcela</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Lote Norte 1" {...field} />
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
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: LN-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="superficie"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Superficie (hectáreas)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ubicacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ubicación</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Coordenadas GPS" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="activa">Activa</SelectItem>
                          <SelectItem value="inactiva">Inactiva</SelectItem>
                          <SelectItem value="en barbecho">En Barbecho</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sector"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sector</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Norte" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit">{parcela ? "Guardar Cambios" : "Crear Parcela"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

ParcelaForm.displayName = 'ParcelaForm';
