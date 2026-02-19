"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retriedRef = useRef(false);
  const isChunkLoadError = /ChunkLoadError|Loading chunk/i.test(error?.message || "");

  useEffect(() => {
    if (isChunkLoadError && !retriedRef.current) {
      retriedRef.current = true;
      const timer = window.setTimeout(() => {
        reset();
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [isChunkLoadError, reset]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-lg font-semibold">Ocurrió un error al cargar la pantalla</h2>
      <p className="max-w-lg text-sm text-muted-foreground">
        {isChunkLoadError
          ? "Hubo un problema temporal al descargar los archivos de la app. Intenta recargar para continuar."
          : "Se produjo un error inesperado. Intenta nuevamente."}
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
