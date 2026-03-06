"use client";

import { useState } from "react";
import { FileDown, Image as ImageIcon, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { defaultReportBranding, getReportBrandingFromEmpresa, type ReportBranding } from "@/lib/report-branding";
import { cn } from "@/lib/utils";

interface ReportActionsProps {
  reportTitle: string;
  reportSummary?: string;
  className?: string;
  imageTargetId?: string;
  printTargetId?: string;
  branding?: ReportBranding;
  documentLabel?: string;
  showDefaultFooter?: boolean;
}

interface PrintableReportOptions {
  documentLabel?: string;
  showDefaultFooter?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildShareText(reportTitle: string, reportSummary?: string): string {
  const generatedAt = new Date().toLocaleString("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const parts = [
    `*${reportTitle}*`,
    reportSummary ? `Resumen: ${reportSummary}` : undefined,
    `Generado: ${generatedAt}`,
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

function findPrintTarget(printTargetId?: string): HTMLElement | null {
  if (printTargetId) {
    const target = document.getElementById(printTargetId);
    if (target) return target;
  }

  const explicitArea =
    document.getElementById("pdf-area") || (document.querySelector(".print-area") as HTMLElement | null);
  if (explicitArea) return explicitArea;

  const semanticRoot = document.querySelector(
    "[data-report-root], [role='main'], main"
  ) as HTMLElement | null;
  if (semanticRoot) return semanticRoot;

  return null;
}

function findImageTarget(imageTargetId?: string, printTargetId?: string): HTMLElement | null {
  if (printTargetId) {
    const printTarget = document.getElementById(printTargetId);
    if (printTarget) return printTarget;
  }
  if (imageTargetId) {
    const imageTarget = document.getElementById(imageTargetId);
    if (imageTarget) return imageTarget;
  }
  return findPrintTarget();
}

function getHeadStylesForPrint(): string {
  return Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
    .filter((node) => {
      if (node.tagName !== "STYLE") return true;
      const element = node as HTMLStyleElement;
      if (element.hasAttribute("data-next-hide-fouc")) return false;
      const cssText = (element.textContent || "").replace(/\s+/g, "");
      if (cssText.includes("body{display:none}") || cssText.includes("body{display:none!important}")) {
        return false;
      }
      return true;
    })
    .map((node) => node.outerHTML)
    .join("\n");
}

function getPrintableHtml(
  target: HTMLElement,
  title: string,
  summary: string | undefined,
  branding: ReportBranding,
  options: PrintableReportOptions = {}
): string {
  const headStyles = getHeadStylesForPrint();
  const generatedAt = new Date().toLocaleString("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const safeTitle = escapeHtml(title);
  const safeSummary = summary ? escapeHtml(summary) : "";
  const safeGenerated = escapeHtml(generatedAt);
  const safeCompanyName = escapeHtml(branding.companyName);
  const safeLegalName = branding.legalName ? escapeHtml(branding.legalName) : "";
  const safeRuc = branding.ruc ? escapeHtml(branding.ruc) : "";
  const safeAddress = branding.address ? escapeHtml(branding.address) : "";
  const safeContact = branding.contact ? escapeHtml(branding.contact) : "";
  const safePreparedBy = escapeHtml(branding.preparedBy || "Responsable");
  const safeApprovedBy = escapeHtml(branding.approvedBy || "Aprobado por");
  const safeLogoSrc = branding.logoSrc ? escapeHtml(branding.logoSrc) : "";
  const safeLogoFallbacks = (branding.logoFallbackSrcList || [])
    .map((item) => escapeHtml(item))
    .join(",");
  const safeDocumentLabel = escapeHtml(options.documentLabel || "Reporte");
  const showDefaultFooter = options.showDefaultFooter ?? true;

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
      html, body { margin: 0; background: #fff; color: #111; font-family: "Segoe UI", Arial, sans-serif; }
      .report-layout { background: #fff; }
      .report-sheet {
        max-width: 1120px;
        margin: 0 auto;
        border: 1px solid #cbd5e1;
        border-radius: 0;
        padding: 12px 14px 14px;
        background: #fff;
      }
      .report-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: start;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 10px;
        margin-bottom: 12px;
      }
      .report-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-logo {
        width: 64px;
        height: 64px;
        object-fit: contain;
        border: 1px solid #e5e7eb;
        border-radius: 0;
        padding: 4px;
        background: #fff;
      }
      .brand-name { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
      .brand-line { margin: 2px 0 0; font-size: 10.5px; color: #475569; }
      .report-title { margin: 10px 0 0; font-size: 18px; font-weight: 700; color: #0f172a; }
      .report-summary { margin: 4px 0 0; font-size: 11.5px; color: #334155; }
      .report-meta { text-align: right; font-size: 11px; color: #475569; border-left: 1px solid #e2e8f0; padding-left: 12px; }
      .no-print { display: none !important; }
      .print-root { font-size: 12px; line-height: 1.45; color: #0f172a; }
      .print-root, .print-root * { box-shadow: none !important; }
      .print-root .card { background: #fff !important; border-color: #d1d5db !important; }
      .print-root [class*="rounded"] { border-radius: 0 !important; }
      .print-root [class*="shadow"] { box-shadow: none !important; }
      .print-root .overflow-hidden,
      .print-root .overflow-x-hidden,
      .print-root .overflow-y-auto,
      .print-root [class*="overflow-"] { overflow: visible !important; }
      .report-export-only {
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: auto !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        z-index: auto !important;
      }
      .print-root [class*="max-h-"] { max-height: none !important; }
      .print-root [class*="h-\\["] { height: auto !important; }
      .print-root article,
      .print-root section,
      .print-root .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
      .print-root table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
      .print-root th, .print-root td {
        border-bottom: 1px solid #d1d5db;
        padding: 5px 7px;
        text-align: left;
        vertical-align: top;
      }
      .print-root thead th {
        background: #f8fafc !important;
        font-weight: 700;
        color: #0f172a;
        border-top: 1px solid #d1d5db;
      }
      .print-root tfoot td { background: #f8fafc !important; font-weight: 700; border-top: 1px solid #cbd5e1; }
      .print-root thead { display: table-header-group; }
      .print-root tfoot { display: table-footer-group; }
      .print-root tr, .print-root td, .print-root th { page-break-inside: avoid; break-inside: avoid; }
      .report-footer {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
      }
      .signature-box {
        border: 0;
        border-top: 1px solid #94a3b8;
        border-radius: 0;
        padding: 8px 0 0;
        min-height: auto;
      }
      .signature-line { display: none; }
      .signature-label { margin: 6px 0 0; font-size: 10.5px; color: #475569; }
      .signature-name { margin: 2px 0 0; font-size: 11.5px; font-weight: 700; color: #0f172a; }
    </style>
  </head>
  <body>
    <main class="report-layout">
      <section id="report-sheet" class="report-sheet">
        <header class="report-header">
          <div>
            <div class="report-brand">
              ${
                safeLogoSrc
                  ? `<img
                      src="${safeLogoSrc}"
                      alt="Logo"
                      class="brand-logo"
                      data-fallbacks="${safeLogoFallbacks}"
                      data-fallback-index="0"
                      onerror="(function(img){var list=(img.getAttribute('data-fallbacks')||'').split(',').filter(Boolean);var idx=Number(img.getAttribute('data-fallback-index')||'0');if(idx<list.length){img.src=list[idx];img.setAttribute('data-fallback-index', String(idx+1));return;}img.style.display='none';})(this);"
                    />`
                  : ""
              }
              <div>
                <p class="brand-name">${safeCompanyName}</p>
                ${safeLegalName ? `<p class="brand-line">${safeLegalName}</p>` : ""}
                ${safeRuc ? `<p class="brand-line">${safeRuc}</p>` : ""}
                ${safeAddress ? `<p class="brand-line">${safeAddress}</p>` : ""}
                ${safeContact ? `<p class="brand-line">${safeContact}</p>` : ""}
              </div>
            </div>
            <h1 class="report-title">${safeTitle}</h1>
            ${safeSummary ? `<p class="report-summary">${safeSummary}</p>` : ""}
          </div>
          <div class="report-meta">
            <div><strong>Documento:</strong> ${safeDocumentLabel}</div>
            <div><strong>Generado:</strong> ${safeGenerated}</div>
          </div>
        </header>
        <div class="print-root">${target.outerHTML}</div>
        ${
          showDefaultFooter
            ? `<footer class="report-footer">
                <section class="signature-box">
                  <span class="signature-line"></span>
                  <p class="signature-label">Elaborado por</p>
                  <p class="signature-name">${safePreparedBy}</p>
                </section>
                <section class="signature-box">
                  <span class="signature-line"></span>
                  <p class="signature-label">Aprobado por</p>
                  <p class="signature-name">${safeApprovedBy}</p>
                </section>
              </footer>`
            : ""
        }
      </section>
    </main>
  </body>
</html>`;
}

async function waitForDocumentAssets(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(async (image) => {
      const maxAttempts = 6;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (image.complete && image.naturalWidth > 0) return;

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          window.setTimeout(done, 600);
        });

        if (image.complete && image.naturalWidth > 0) return;
      }
    })
  );
}

async function printHtmlInIframe(html: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1400px";
  iframe.style.height = "900px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    iframe.srcdoc = html;
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const frameDocument = iframe.contentDocument;
    if (frameDocument?.fonts?.ready) {
      await frameDocument.fonts.ready.catch(() => undefined);
    }
    if (frameDocument) {
      await waitForDocumentAssets(frameDocument);
    }

    const frameWindow = iframe.contentWindow;
    if (!frameWindow) throw new Error("No se pudo abrir el documento de impresion.");
    await new Promise<void>((resolve) => {
      frameWindow.requestAnimationFrame(() => resolve());
    });
    frameWindow.focus();
    frameWindow.print();

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      frameWindow.addEventListener("afterprint", done, { once: true });
      window.setTimeout(done, 2500);
    });
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

async function printHtmlInNewWindow(html: string): Promise<void> {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");
  if (!printWindow) {
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    if (printWindow.document.readyState === "complete") {
      done();
      return;
    }
    printWindow.addEventListener("load", done, { once: true });
    window.setTimeout(done, 700);
  });

  if (printWindow.document.fonts?.ready) {
    await printWindow.document.fonts.ready.catch(() => undefined);
  }
  await waitForDocumentAssets(printWindow.document);

  printWindow.focus();
  printWindow.print();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    printWindow.addEventListener("afterprint", done, { once: true });
    window.setTimeout(done, 2500);
  });

  printWindow.close();
}

async function renderReportCanvas(html: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1400px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    iframe.srcdoc = html;
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const frameDocument = iframe.contentDocument;
    if (!frameDocument) {
      throw new Error("No se pudo preparar el documento para exportar.");
    }
    if (frameDocument.fonts?.ready) {
      await frameDocument.fonts.ready.catch(() => undefined);
    }
    await waitForDocumentAssets(frameDocument);

    const target = frameDocument.getElementById("report-sheet") as HTMLElement | null;
    if (!target) throw new Error("No se pudo renderizar el contenido del reporte.");

    const { default: html2canvas } = await import("html2canvas");
    return await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: Math.max(target.scrollWidth, target.clientWidth),
      windowHeight: Math.max(target.scrollHeight, target.clientHeight),
    });
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}

async function downloadPdfFromHtml(html: string, fileName: string): Promise<void> {
  const [{ default: jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    renderReportCanvas(html),
  ]);

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const renderedHeight = (canvas.height * usableWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png");
  const printableHeight = pageHeight - margin * 2;

  let remainingHeight = renderedHeight;
  let offsetY = 0;

  while (remainingHeight > 0) {
    if (offsetY > 0) {
      pdf.addPage();
    }

    pdf.addImage(imgData, "PNG", margin, margin - offsetY, usableWidth, renderedHeight);
    remainingHeight -= printableHeight;
    offsetY += printableHeight;
  }

  pdf.save(`${fileName}.pdf`);
}

export function ReportActions({
  reportTitle,
  reportSummary,
  className,
  imageTargetId,
  printTargetId,
  branding,
  documentLabel,
  showDefaultFooter,
}: ReportActionsProps) {
  const { empresa } = useAuth();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportBranding = branding || getReportBrandingFromEmpresa(empresa) || defaultReportBranding;
  const printableOptions = { documentLabel, showDefaultFooter };

  const handlePrint = async () => {
    const target = findPrintTarget(printTargetId);
    if (target) {
      const html = getPrintableHtml(target, reportTitle, reportSummary, reportBranding, printableOptions);
      try {
        await printHtmlInIframe(html);
        return;
      } catch (error) {
        console.error("No se pudo imprimir el reporte:", error);
        try {
          await printHtmlInNewWindow(html);
          return;
        } catch (fallbackError) {
          console.error("No se pudo imprimir con ventana auxiliar:", fallbackError);
        }
      }
    }
    window.print();
  };

  const handleShareWhatsApp = () => {
    openWhatsApp(buildShareText(reportTitle, reportSummary));
  };

  const handleShareWhatsAppImage = async () => {
    const target = findImageTarget(imageTargetId, printTargetId);
    if (!target) {
      openWhatsApp(buildShareText(reportTitle, reportSummary));
      return;
    }

    setIsGeneratingImage(true);
    try {
      const reportHtml = getPrintableHtml(target, reportTitle, reportSummary, reportBranding, printableOptions);
      const canvas = await renderReportCanvas(reportHtml);

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

  const handleDownloadPdf = async () => {
    const target = findPrintTarget(printTargetId);
    if (!target) {
      throw new Error("No se encontro contenido para exportar a PDF.");
    }

    setIsGeneratingPdf(true);
    try {
      const reportHtml = getPrintableHtml(target, reportTitle, reportSummary, reportBranding, printableOptions);
      await downloadPdfFromHtml(reportHtml, getSafeFileName(reportTitle));
    } catch (error) {
      console.error("No se pudo generar el PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className={cn("flex w-full flex-wrap items-center justify-start gap-2 no-print md:w-auto md:justify-end", className)}>
      <Button type="button" variant="outline" onClick={() => void handlePrint()}>
        <Printer className="mr-2 h-4 w-4" />
        Imprimir
      </Button>
      <Button type="button" variant="outline" onClick={() => void handleDownloadPdf()} disabled={isGeneratingPdf}>
        <FileDown className="mr-2 h-4 w-4" />
        {isGeneratingPdf ? "Generando PDF..." : "PDF"}
      </Button>
      <Button type="button" variant="outline" onClick={handleShareWhatsApp}>
        <MessageCircle className="mr-2 h-4 w-4" />
        WhatsApp
      </Button>
      {(imageTargetId || printTargetId) && (
        <Button type="button" variant="outline" onClick={handleShareWhatsAppImage} disabled={isGeneratingImage}>
          <ImageIcon className="mr-2 h-4 w-4" />
          {isGeneratingImage ? "Generando..." : "WhatsApp imagen"}
        </Button>
      )}
    </div>
  );
}
