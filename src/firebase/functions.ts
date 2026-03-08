"use client";

import { useMemo } from "react";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { useFirebaseApp } from "@/firebase/provider";

let emulatorConnected = false;

export function useFirebaseFunctions() {
  const firebaseApp = useFirebaseApp();

  return useMemo(() => {
    const functions = getFunctions(firebaseApp);

    if (!emulatorConnected && typeof window !== "undefined" && window.location.hostname === "localhost") {
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      emulatorConnected = true;
    }

    return functions;
  }, [firebaseApp]);
}

export function useCallableFunction<TRequest = unknown, TResponse = unknown>(name: string) {
  const functions = useFirebaseFunctions();

  return useMemo(() => httpsCallable<TRequest, TResponse>(functions, name), [functions, name]);
}
