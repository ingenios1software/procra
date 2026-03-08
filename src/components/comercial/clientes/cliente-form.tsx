"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Cliente } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { getDocs, limit, orderBy, query } from "firebase/firestore";
import { useTenantFirestore } from "@/hooks/use-tenant-firestore";

const formSchema = z.object({
  nombre: z.string().min(3, "El nombre es muy corto."),
  ruc: z.string().min(5, "El RUC/DNI es muy corto."),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email invalido.").optional().or(z.literal("")),
  ciudad: z.string().optional(),
  pais: z.string().optional(),
  tipoCliente: z.enum(["productor", "acopiador", "industria", "exportadora", "interno"]).optional(),
  observaciones: z.string().optional(),
  activo: z.boolean().default(true),
});

type ClienteFormValues = z.infer<typeof formSchema>;

interface ClienteFormProps {
  cliente?: Cliente;
}

export function ClienteForm({ cliente }: ClienteFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tenant = useTenantFirestore();
  const form = useForm<ClienteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: cliente || {
      nombre: "",
      ruc: "",
      tipoCliente: "productor",
      activo: true,
    },
  });

  const handleSubmit = async (data: ClienteFormValues) => {
    const clientesCol = tenant.collection("clientes");
    if (!clientesCol) return;

    if (cliente?.id) {
      const clienteRef = tenant.doc("clientes", cliente.id);
      if (!clienteRef) return;
      updateDocumentNonBlocking(clienteRef, data);
      toast({
        title: "Cliente actualizado",
        description: `El cliente ${data.nombre} fue guardado correctamente.`,
      });
    } else {
      const lastQuery = query(clientesCol, orderBy("numeroItem", "desc"), limit(1));
      const querySnapshot = await getDocs(lastQuery);
      const maxNumeroItem = querySnapshot.empty ? 0 : Number(querySnapshot.docs[0].data().numeroItem || 0);
      const numeroItem = maxNumeroItem + 1;

      addDocumentNonBlocking(clientesCol, { ...data, numeroItem });
      toast({
        title: "Cliente creado",
        description: `El cliente ${data.nombre} (Item No ${numeroItem}) fue guardado.`,
      });
    }

    router.push("/comercial/clientes");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                name="nombre"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre o Razon Social</FormLabel>
                    <FormControl>
                      <Input placeholder="Cliente Ejemplo S.A." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="ruc"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RUC / DNI</FormLabel>
                    <FormControl>
                      <Input placeholder="80098765-3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              name="direccion"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direccion</FormLabel>
                  <FormControl>
                    <Input placeholder="Av. Siempre Viva 742" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                name="telefono"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input placeholder="0971 987654" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="email"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="compras@cliente.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                name="ciudad"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input placeholder="Villeta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="pais"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pais</FormLabel>
                    <FormControl>
                      <Input placeholder="Paraguay" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="tipoCliente"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cliente</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="productor">Productor</SelectItem>
                      <SelectItem value="acopiador">Acopiador</SelectItem>
                      <SelectItem value="industria">Industria</SelectItem>
                      <SelectItem value="exportadora">Exportadora</SelectItem>
                      <SelectItem value="interno">Interno</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="observaciones"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales sobre el cliente..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit">{cliente ? "Guardar Cambios" : "Crear Cliente"}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
