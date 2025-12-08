"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/icons";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 2000); // Espera 2 segundos antes de redirigir

    return () => clearTimeout(timer); // Limpia el temporizador si el componente se desmonta
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5EF] p-4 text-center">
      <div className="w-full max-w-md space-y-4">
        {/* Ícono */}
        <div className="mx-auto h-16 w-16 text-primary">
          <Logo />
        </div>

        {/* Título y Subtítulo */}
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-800 font-headline sm:text-5xl">
            CRApro95
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Sistema de Gestión Agrícola
          </p>
        </div>

        {/* Animación de Carga */}
        <div className="pt-4">
          <p className="animate-pulse text-sm text-gray-500">
            Iniciando sistema…
          </p>
        </div>
      </div>
    </main>
  );
}
