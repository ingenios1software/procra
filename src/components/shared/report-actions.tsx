"use client";

import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportActionsProps {
  reportTitle: string;
  reportSummary?: string;
  className?: string;
}

export function ReportActions({ reportTitle, reportSummary, className }: ReportActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const parts = [
      reportTitle,
      reportSummary,
      `URL: ${window.location.href}`,
    ].filter(Boolean);

    const text = encodeURIComponent(parts.join("\n"));
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn("flex w-full flex-wrap items-center justify-start gap-2 no-print md:w-auto md:justify-end", className)}>
      <Button type="button" variant="outline" onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        Imprimir
      </Button>
      <Button type="button" variant="outline" onClick={handleShareWhatsApp}>
        <MessageCircle className="mr-2 h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
}
