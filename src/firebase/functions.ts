"use client";

import { useMemo } from "react";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { useFirebaseApp } from "@/firebase/provider";

let emulatorConnected = false;
const USE_FUNCTIONS_EMULATOR = process.env.NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR === "true";
const FUNCTIONS_EMULATOR_HOST = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST || "127.0.0.1";
const FUNCTIONS_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT || "5001");

export function useFirebaseFunctions() {
  const firebaseApp = useFirebaseApp();

  return useMemo(() => {
    const functions = getFunctions(firebaseApp);

    if (!emulatorConnected && USE_FUNCTIONS_EMULATOR) {
      connectFunctionsEmulator(functions, FUNCTIONS_EMULATOR_HOST, FUNCTIONS_EMULATOR_PORT);
      emulatorConnected = true;
    }

    return functions;
  }, [firebaseApp]);
}

export function useCallableFunction<TRequest = unknown, TResponse = unknown>(name: string) {
  const functions = useFirebaseFunctions();

  return useMemo(() => httpsCallable<TRequest, TResponse>(functions, name), [functions, name]);
}

export function formatCallableError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Error inesperado.";
  }

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
  };

  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const code = typeof candidate.code === "string" ? candidate.code.trim() : "";
  const details =
    typeof candidate.details === "string"
      ? candidate.details.trim()
      : candidate.details !== undefined && candidate.details !== null
        ? JSON.stringify(candidate.details)
        : "";

  if (USE_FUNCTIONS_EMULATOR && code === "functions/unavailable") {
    return `No se pudo conectar al emulador de Functions en ${FUNCTIONS_EMULATOR_HOST}:${FUNCTIONS_EMULATOR_PORT}.`;
  }

  return [message, code, details].filter(Boolean).join(" | ") || "Error inesperado.";
}
