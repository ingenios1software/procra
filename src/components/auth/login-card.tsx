"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
import { Logo } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formSchema = z.object({
  email: z.string().email({ message: "Por favor, introduce un email válido." }),
  password: z.string().min(1, { message: "La contraseña es obligatoria." }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export function LoginCard() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    console.log(values);
    // Simular llamada a API
    setTimeout(() => {
      if (values.email === "admin@crapro95.com" && values.password === "password") {
        toast({
          title: "Inicio de sesión exitoso",
          description: "Bienvenido de nuevo.",
        });
        router.push("/dashboard");
      } else {
        toast({
          variant: "destructive",
          title: "Error de autenticación",
          description: "El email o la contraseña son incorrectos.",
        });
        setIsLoading(false);
      }
    }, 1500);
  }

  return (
    <Card className="w-full max-w-sm rounded-2xl shadow-xl animate-in fade-in-0 slide-in-from-bottom-5">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Logo className="h-16 w-16" />
        </div>
        <CardTitle className="text-2xl font-headline">Bienvenido a CRApro95</CardTitle>
        <CardDescription>
          Control de Registro Agropecuario Profesional
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tu@email.com"
                        className="pl-10"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <div className="relative">
                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary/80 text-lg font-bold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm">
        <Link
          href="#"
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </CardFooter>
    </Card>
  );
}
