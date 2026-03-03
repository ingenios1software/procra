import { format } from "date-fns";

export type BiometricInterval = {
  start: string;
  end: string;
};

export type ParsedBiometricRecord = {
  employeeName: string;
  dateKey: string; // yyyy-MM-dd
  intervals: BiometricInterval[];
  sourceRow: number;
  local?: string;
  parcelaName?: string;
  jobType?: string;
  pricePerHourGs?: number;
};

export type BiometricParseResult = {
  records: ParsedBiometricRecord[];
  errors: string[];
  format: "row" | "matrix" | "unknown";
  sheetName?: string;
};

export type BiometricParseOptions = {
  matrixMonth: number; // 0-11
  matrixYear: number; // 4-digit year
};

const TIME_REGEX = /\b([01]?\d|2[0-3]):[0-5]\d\b/g;

const MONTH_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function normalizeText(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanName(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseExcelSerialDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  if (serial <= 0) return null;
  // Excel day 1 = 1900-01-01; JS uses 1899-12-30 for serial conversion
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const millis = Math.round(serial * 24 * 60 * 60 * 1000);
  return new Date(epoch.getTime() + millis);
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    return parseExcelSerialDate(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && /^\d+(\.\d+)?$/.test(raw)) {
    const serialDate = parseExcelSerialDate(asNumber);
    if (serialDate) return serialDate;
  }

  const slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const normalized = normalizeText(raw);
  const spanishLong = normalized.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{2,4})/);
  if (spanishLong) {
    const day = Number(spanishLong[1]);
    const monthName = spanishLong[2];
    let year = Number(spanishLong[3]);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthName];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function normalizeTimeToken(value: string): string {
  const [hRaw, mRaw] = value.split(":");
  const h = String(Number(hRaw)).padStart(2, "0");
  const m = String(Number(mRaw)).padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function extractTimeTokens(value: unknown): string[] {
  const input = String(value ?? "");
  const matches = input.match(TIME_REGEX) ?? [];
  return matches.map(normalizeTimeToken);
}

function pairTimeTokens(tokens: string[]): BiometricInterval[] {
  const intervals: BiometricInterval[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const start = tokens[i];
    const end = tokens[i + 1];
    if (timeToMinutes(end) > timeToMinutes(start)) {
      intervals.push({ start, end });
    }
  }
  return intervals;
}

function parseGsAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.round(value));
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

function rowHasDateAndNameHeaders(row: unknown[]): boolean {
  const normalized = row.map(normalizeText);
  const hasDate = normalized.some((cell) => cell.includes("fecha"));
  const hasName = normalized.some(
    (cell) => cell.includes("nombre") || cell.includes("apellido")
  );
  return hasDate && hasName;
}

function parseRowBasedFormat(rows: unknown[][]): BiometricParseResult | null {
  const headerIndex = rows.findIndex((row, index) => index < 30 && rowHasDateAndNameHeaders(row));
  if (headerIndex < 0) return null;

  const headers = rows[headerIndex].map(normalizeText);
  const nameCol = headers.findIndex((h) => h.includes("nombre") || h.includes("apellido"));
  const dateCol = headers.findIndex((h) => h.includes("fecha"));
  if (nameCol < 0 || dateCol < 0) return null;

  const localCol = headers.findIndex((h) => h === "local" || h.includes("local"));
  const parcelaCol = headers.findIndex((h) => h.includes("parcela"));
  const jobTypeCol = headers.findIndex(
    (h) => h.includes("tipo de trabajo") || h.includes("tipo trabajo")
  );
  const priceCol = headers.findIndex(
    (h) =>
      h.includes("precio por horas") ||
      h.includes("precio por hora") ||
      h.includes("precio/hora") ||
      h === "precio hora"
  );

  const punchCols = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) =>
      header.includes("ent") ||
      header.includes("sal") ||
      header.includes("entrada") ||
      header.includes("salida")
    )
    .map(({ index }) => index);

  const records: ParsedBiometricRecord[] = [];
  const errors: string[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const nameRaw = cleanName(row[nameCol]);
    const dateRaw = row[dateCol];

    if (!nameRaw && !String(dateRaw ?? "").trim()) {
      continue;
    }
    if (!nameRaw || !String(dateRaw ?? "").trim()) {
      continue;
    }

    const parsedDate = parseDateValue(dateRaw);
    if (!parsedDate) {
      errors.push(`Fila ${rowIndex + 1}: no se pudo interpretar la fecha "${String(dateRaw)}".`);
      continue;
    }

    let tokens: string[] = [];
    if (punchCols.length > 0) {
      tokens = punchCols.flatMap((col) => extractTimeTokens(row[col]));
    } else {
      tokens = row.flatMap((cell) => extractTimeTokens(cell));
    }

    const intervals = pairTimeTokens(tokens);
    if (intervals.length === 0) {
      continue;
    }

    const local = localCol >= 0 ? cleanName(row[localCol]) : "";
    const parcelaName = parcelaCol >= 0 ? cleanName(row[parcelaCol]) : "";
    const jobType = jobTypeCol >= 0 ? cleanName(row[jobTypeCol]) : "";
    const pricePerHourGs = priceCol >= 0 ? parseGsAmount(row[priceCol]) : null;

    records.push({
      employeeName: nameRaw,
      dateKey: format(parsedDate, "yyyy-MM-dd"),
      intervals,
      sourceRow: rowIndex + 1,
      local: local || undefined,
      parcelaName: parcelaName || undefined,
      jobType: jobType || undefined,
      pricePerHourGs: pricePerHourGs ?? undefined,
    });
  }

  return { format: "row", records, errors };
}

function parseMatrixDay(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const day = Number(text);
  if (day < 1 || day > 31) return null;
  return day;
}

function parseMatrixFormat(rows: unknown[][], options: BiometricParseOptions): BiometricParseResult | null {
  let dateRowIndex = -1;
  let nameColumnIndex = 0;

  for (let index = 0; index < rows.length && index <= 40; index++) {
    const row = rows[index];
    const normalized = row.map(normalizeText);
    const dayCount = row.reduce<number>((count, value, col) => {
      if (col === 0) return count;
      return parseMatrixDay(value) !== null ? count + 1 : count;
    }, 0);
    if (dayCount < 2) continue;

    const hasFechaToken = normalized.some((cell) => cell.includes("fecha"));
    const hasNombreToken = normalized.some((cell) => cell.includes("nombre") || cell.includes("apellido"));
    if (!hasFechaToken && !hasNombreToken) continue;

    dateRowIndex = index;
    const foundNameCol = normalized.findIndex(
      (cell) => cell.includes("nombre") || cell.includes("apellido")
    );
    nameColumnIndex = foundNameCol >= 0 ? foundNameCol : 0;
    break;
  }

  if (dateRowIndex < 0) return null;

  const dayByColumn = new Map<number, number>();
  rows[dateRowIndex].forEach((value, col) => {
    if (col === 0) return;
    const day = parseMatrixDay(value);
    if (day !== null) dayByColumn.set(col, day);
  });

  if (dayByColumn.size === 0) return null;

  const records: ParsedBiometricRecord[] = [];
  const errors: string[] = [];

  for (let rowIndex = dateRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const employeeName = cleanName(row[nameColumnIndex]);
    if (!employeeName) continue;
    if (normalizeText(employeeName).includes("nombre")) continue;

    for (const [col, day] of dayByColumn.entries()) {
      const cell = row[col];
      const tokens = extractTimeTokens(cell);
      const intervals = pairTimeTokens(tokens);
      if (intervals.length === 0) continue;

      const date = new Date(options.matrixYear, options.matrixMonth, day);
      if (Number.isNaN(date.getTime())) {
        errors.push(
          `Fila ${rowIndex + 1}, columna ${col + 1}: fecha invalida para dia ${day}.`
        );
        continue;
      }

      records.push({
        employeeName,
        dateKey: format(date, "yyyy-MM-dd"),
        intervals,
        sourceRow: rowIndex + 1,
      });
    }
  }

  return { format: "matrix", records, errors };
}

export async function parseBiometricWorkbook(
  file: File,
  options: BiometricParseOptions
): Promise<BiometricParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  const candidates: Array<
    BiometricParseResult & {
      sheetName: string;
    }
  > = [];

  const allErrors: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const rowBased = parseRowBasedFormat(rows);
    if (rowBased) {
      if (rowBased.records.length > 0) {
        candidates.push({ ...rowBased, sheetName });
      } else if (rowBased.errors.length > 0) {
        allErrors.push(...rowBased.errors.map((e) => `[${sheetName}] ${e}`));
      }
    }

    const matrix = parseMatrixFormat(rows, options);
    if (matrix) {
      if (matrix.records.length > 0) {
        candidates.push({ ...matrix, sheetName });
      } else if (matrix.errors.length > 0) {
        allErrors.push(...matrix.errors.map((e) => `[${sheetName}] ${e}`));
      }
    }
  }

  if (candidates.length === 0) {
    return {
      format: "unknown",
      records: [],
      errors: [
        ...allErrors,
        "No se pudo detectar un formato valido de reloj biometrico en el archivo.",
      ],
    };
  }

  candidates.sort((a, b) => b.records.length - a.records.length);
  const best = candidates[0];
  return {
    records: best.records,
    errors: best.errors,
    format: best.format,
    sheetName: best.sheetName,
  };
}

export function normalizeEmployeeName(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}
