"use client";

import { useState, useEffect, useCallback } from 'react';

export const usePrint = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsPrinting(true);
      window.print();
    }
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };

    if (isPrinting && typeof window !== 'undefined') {
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [isPrinting]);

  return { isPrinting, handlePrint };
};
