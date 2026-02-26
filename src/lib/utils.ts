import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const APP_NUMBER_LOCALE = "de-DE"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(APP_NUMBER_LOCALE, options).format(value ?? 0)
}

export function formatCurrency(value: number | null | undefined): string {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatQuantity(
  value: number | null | undefined,
  maxFractionDigits = 3
): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  })
}

export function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
