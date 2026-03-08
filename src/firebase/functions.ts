"use client";

import { useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirebaseApp } from "@/firebase/provider";

export function useFirebaseFunctions() {
  const firebaseApp = useFirebaseApp();

  return useMemo(() => getFunctions(firebaseApp), [firebaseApp]);
}

export function useCallableFunction<TRequest = unknown, TResponse = unknown>(name: string) {
  const functions = useFirebaseFunctions();

  return useMemo(() => httpsCallable<TRequest, TResponse>(functions, name), [functions, name]);
}
