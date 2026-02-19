"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHUNK_RELOAD_KEY = "main-segment-chunk-reload-attempted";

function isChunkLoadError(message: string) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(message);
}

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const triedReloadRef = useRef(false);
  const chunkError = isChunkLoadError(error?.message ?? "");

  useEffect(() => {
    if (!chunkError || triedReloadRef.current) return;

    triedReloadRef.current = true;
    const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";

    if (!alreadyReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
  }, [chunkError]);

  const handleRetry = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    reset();
  };

  const handleReload = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" />
      <h2 className="text-lg font-semibold">Ocurrió un error al cargar la pantalla</h2>
      <p className="max-w-lg text-sm text-muted-foreground">
        {chunkError
          ? "Firebase Studio no pudo cargar un archivo dinámico a tiempo. Se intentó una recarga automática una vez; si persiste, usa 'Recargar página'."
          : "Se produjo un error inesperado. Intenta nuevamente."}
      </p>
      <div className="flex gap-2">
        <Button onClick={handleRetry} variant="outline">
          Reintentar
        </Button>
        <Button onClick={handleReload}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar página
        </Button>
      </div>
    </div>
  );
}
