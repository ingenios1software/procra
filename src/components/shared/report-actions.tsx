"use client";

import { useState } from "react";
import { Image as ImageIcon, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReportActionsProps {
  reportTitle: string;
  reportSummary?: string;
  className?: string;
  imageTargetId?: string;
  printTargetId?: string;
}

function buildShareText(reportTitle: string, reportSummary?: string): string {
  const parts = [
    reportTitle,
    reportSummary,
    `URL: ${window.location.href}`,
  ].filter(Boolean);

  return parts.join("\n");
}

function openWhatsApp(text: string) {
  const encoded = encodeURIComponent(text);
  const whatsappUrl = `https://wa.me/?text=${encoded}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
}

function getSafeFileName(reportTitle: string): string {
  return reportTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "reporte";
}

function getPrintableHtml(target: HTMLElement, title: string): string {
  const headStyles = Array.from(
    document.querySelectorAll("link[rel='stylesheet'], style")
  )
    .map((node) => node.outerHTML)
    .join("\n");

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${headStyles}
    <style>
      @page { margin: 12mm; }
      body { background: #fff; color: #111; }
      .no-print { display: none !important; }
      .print-root, .print-root * { box-shadow: none !important; }
      .print-root .overflow-hidden,
      .print-root .overflow-x-hidden,
      .print-root .overflow-y-auto,
      .print-root [class*="overflow-"] { overflow: visible !important; }
      .print-root [class*="max-h-"] { max-height: none !important; }
      .print-root [class*="h-\\["] { height: auto !important; }
    </style>
  </head>
  <body>
    <div class="print-root">${target.outerHTML}</div>
  </body>
</html>`;
}

export function ReportActions({
  reportTitle,
  reportSummary,
  className,
  imageTargetId,
  printTargetId,
}: ReportActionsProps) {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handlePrint = () => {
    if (printTargetId) {
      const target = document.getElementById(printTargetId);
      if (target) {
        const popup = window.open("", "_blank", "noopener,noreferrer,width=1000,height=800");
        if (popup) {
          popup.document.open();
          popup.document.write(getPrintableHtml(target, reportTitle));
          popup.document.close();
          popup.focus();
          popup.addEventListener("load", () => {
            popup.print();
            popup.close();
          });
          return;
        }
      }
    }
    window.print();
  };

  const handleShareWhatsApp = () => {
    openWhatsApp(buildShareText(reportTitle, reportSummary));
  };

  const handleShareWhatsAppImage = async () => {
    if (!imageTargetId) return;

    const element = document.getElementById(imageTargetId);
    if (!element) {
      openWhatsApp(buildShareText(reportTitle, reportSummary));
      return;
    }

    setIsGeneratingImage(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        openWhatsApp(buildShareText(reportTitle, reportSummary));
        return;
      }

      const fileName = `${getSafeFileName(reportTitle)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      const canShareFiles =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles && typeof navigator.share === "function") {
        await navigator.share({
          files: [file],
          title: reportTitle,
          text: reportSummary || reportTitle,
        });
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      const fallbackText = `${buildShareText(reportTitle, reportSummary)}\nImagen generada y descargada. Adjuntala en WhatsApp desde tu galeria o descargas.`;
      openWhatsApp(fallbackText);
    } catch (error) {
      console.error("No se pudo generar la imagen para compartir:", error);
      openWhatsApp(buildShareText(reportTitle, reportSummary));
    } finally {
      setIsGeneratingImage(false);
    }
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
      {imageTargetId && (
        <Button type="button" variant="outline" onClick={handleShareWhatsAppImage} disabled={isGeneratingImage}>
          <ImageIcon className="mr-2 h-4 w-4" />
          {isGeneratingImage ? "Generando..." : "WhatsApp imagen"}
        </Button>
      )}
    </div>
  );
}
