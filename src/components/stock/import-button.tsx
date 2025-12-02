"use client";

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ImportButtonProps {
  onClick: () => void;
}

export function ImportButton({ onClick }: ImportButtonProps) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Upload className="mr-2 h-4 w-4" />
      Importar Excel
    </Button>
  );
}
