import { format } from "date-fns";

export type BiometricInterval = {
  start: string;
  end: string;
};

export type ParsedBiometricRecord = {
  employeeName: string;
  employeeCode?: string;
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
  format: "row" | "matrix" | "card" | "log" | "unknown";
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

const EMPLOYEE_NAME_HEADER_KEYWORDS = [
  "nombre",
  "apellido",
  "empleado",
  "employee",
  "name",
  "worker",
  "usuario",
  "user name",
];

const EMPLOYEE_ID_HEADER_KEYWORDS = [
  "id empleado",
  "employee id",
  "user id",
  "enroll id",
  "enrol id",
  "enroll number",
  "enrol number",
  "badge id",
  "badge no",
  "badge number",
  "card no",
  "card number",
  "numero de tarjeta",
  "nro tarjeta",
  "codigo empleado",
  "cod empleado",
  "legajo",
  "pin",
];

const DATE_HEADER_KEYWORDS = ["fecha", "date", "day"];
const TIME_HEADER_KEYWORDS = [
  "hora",
  "hour",
  "time",
  "marcacion",
  "punch",
  "check in",
  "check out",
  "clock in",
  "clock out",
  "transaction time",
];

function includesAny(value: string, tokens: string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function normalizeText(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isEmployeeNameHeader(value: string): boolean {
  return includesAny(value, EMPLOYEE_NAME_HEADER_KEYWORDS);
}

function isEmployeeIdHeader(value: string): boolean {
  return includesAny(value, EMPLOYEE_ID_HEADER_KEYWORDS);
}

function isEmployeeHeader(value: string): boolean {
  return isEmployeeNameHeader(value) || isEmployeeIdHeader(value);
}

function isDateHeader(value: string): boolean {
  return includesAny(value, DATE_HEADER_KEYWORDS);
}

function isTimeHeader(value: string): boolean {
  return includesAny(value, TIME_HEADER_KEYWORDS);
}

function isDateTimeHeader(value: string): boolean {
  return (
    includesAny(value, ["fecha hora", "fecha y hora", "date time", "datetime", "transaction date"]) ||
    (isDateHeader(value) && isTimeHeader(value))
  );
}

function findEmployeeNameColumn(headers: string[]): number {
  return headers.findIndex((header) => isEmployeeNameHeader(header));
}

function findEmployeeIdColumn(headers: string[]): number {
  return headers.findIndex((header) => isEmployeeIdHeader(header));
}

function findEmployeeColumn(headers: string[]): number {
  const idColumn = findEmployeeIdColumn(headers);
  if (idColumn >= 0) return idColumn;
  return findEmployeeNameColumn(headers);
}

function expandCompactWords(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2")
    .replace(/([A-ZÁÉÍÓÚÑ])([A-ZÁÉÍÓÚÑ][a-záéíóúñ])/g, "$1 $2");
}

function cleanName(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanImportedEmployeeCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function cleanImportedEmployeeName(value: unknown): string {
  const base = cleanName(expandCompactWords(String(value ?? "")));
  return base.replace(/(?:\s+\d+)+$/, "").trim();
}

function getImportedEmployeeLabel(employeeName?: string, employeeCode?: string): string {
  return cleanName(employeeName) || cleanName(employeeCode) || "";
}

function hasLetters(value: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(value);
}

function looksLikeEmployeeCode(value: string): boolean {
  const cleaned = cleanImportedEmployeeCode(value);
  if (!cleaned) return false;
  return /\d/.test(cleaned) || !hasLetters(cleaned);
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

function parseDateTimeValue(value: unknown): { date: Date | null; time?: string } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, time: format(value, "HH:mm") };
  }

  if (typeof value === "number") {
    const parsed = parseExcelSerialDate(value);
    return parsed ? { date: parsed, time: format(parsed, "HH:mm") } : { date: null };
  }

  const raw = String(value ?? "").trim();
  if (!raw) return { date: null };

  const tokens = extractTimeTokens(raw);
  const time = tokens[0];
  const withoutTime = time
    ? raw.replace(time, " ").replace(/\s+/g, " ").trim()
    : raw;

  const date = parseDateValue(withoutTime) || parseDateValue(raw);
  return { date, time };
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
  const hasDate = normalized.some((cell) => isDateHeader(cell));
  const hasName = normalized.some((cell) => isEmployeeHeader(cell));
  return hasDate && hasName;
}

function isStandaloneDateCell(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return true;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return false;

  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(raw)) {
    return true;
  }

  const normalized = normalizeText(raw);
  return /^\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{2,4}$/.test(normalized);
}

function extractStandaloneDateColumns(
  row: unknown[]
): Array<{
  col: number;
  date: Date;
}> {
  const columns: Array<{ col: number; date: Date }> = [];

  row.forEach((value, col) => {
    if (!isStandaloneDateCell(value)) return;
    const parsedDate = parseDateValue(value);
    if (!parsedDate) return;
    columns.push({ col, date: parsedDate });
  });

  return columns;
}

function countNonEmptyCells(row: unknown[]): number {
  return row.reduce<number>((count, value) => (cleanName(value) ? count + 1 : count), 0);
}

function parseRowBasedFormat(rows: unknown[][]): BiometricParseResult | null {
  const headerIndex = rows.findIndex((row, index) => index < 30 && rowHasDateAndNameHeaders(row));
  if (headerIndex < 0) return null;

  const headers = rows[headerIndex].map(normalizeText);
  const employeeIdCol = findEmployeeIdColumn(headers);
  const employeeNameCol = findEmployeeNameColumn(headers);
  const employeeCol = employeeIdCol >= 0 ? employeeIdCol : employeeNameCol;
  const dateCol = headers.findIndex((h) => isDateHeader(h));
  if (employeeCol < 0 || dateCol < 0) return null;

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
      header.includes("salida") ||
      isTimeHeader(header)
    )
    .map(({ index }) => index);

  const records: ParsedBiometricRecord[] = [];
  const errors: string[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const employeeCode = employeeIdCol >= 0 ? cleanImportedEmployeeCode(row[employeeIdCol]) : "";
    const employeeName = employeeNameCol >= 0 ? cleanImportedEmployeeName(row[employeeNameCol]) : "";
    const employeeLabel = getImportedEmployeeLabel(employeeName, employeeCode);
    const dateRaw = row[dateCol];

    if (!employeeLabel && !String(dateRaw ?? "").trim()) {
      continue;
    }
    if ((!employeeCode && !employeeName) || !String(dateRaw ?? "").trim()) {
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
      employeeName: employeeLabel,
      employeeCode: employeeCode || undefined,
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

function parsePunchLogFormat(rows: unknown[][]): BiometricParseResult | null {
  let headerIndex = -1;
  let employeeCol = -1;
  let employeeIdCol = -1;
  let employeeNameCol = -1;
  let dateCol = -1;
  let timeCol = -1;
  let dateTimeCol = -1;

  for (let index = 0; index < rows.length && index <= 40; index++) {
    const headers = rows[index].map(normalizeText);
    const candidateEmployeeIdCol = findEmployeeIdColumn(headers);
    const candidateEmployeeNameCol = findEmployeeNameColumn(headers);
    const candidateEmployeeCol =
      candidateEmployeeIdCol >= 0 ? candidateEmployeeIdCol : candidateEmployeeNameCol;
    if (candidateEmployeeCol < 0) continue;

    const candidateDateTimeCol = headers.findIndex((header) => isDateTimeHeader(header));
    const candidateDateCol = headers.findIndex((header) => isDateHeader(header));
    const candidateTimeCol = headers.findIndex((header) => isTimeHeader(header));

    const hasCombinedDateTime = candidateDateTimeCol >= 0;
    const hasSeparateDateAndTime =
      candidateDateCol >= 0 && candidateTimeCol >= 0 && candidateDateCol !== candidateTimeCol;

    if (!hasCombinedDateTime && !hasSeparateDateAndTime) continue;

    headerIndex = index;
    employeeCol = candidateEmployeeCol;
    employeeIdCol = candidateEmployeeIdCol;
    employeeNameCol = candidateEmployeeNameCol;
    dateTimeCol = candidateDateTimeCol;
    dateCol = candidateDateCol;
    timeCol = candidateTimeCol;
    break;
  }

  if (headerIndex < 0 || employeeCol < 0) return null;

  const headers = rows[headerIndex].map(normalizeText);
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

  const grouped = new Map<
    string,
    {
      employeeName: string;
      employeeCode?: string;
      dateKey: string;
      times: string[];
      sourceRow: number;
      local?: string;
      parcelaName?: string;
      jobType?: string;
      pricePerHourGs?: number;
    }
  >();
  const errors: string[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const employeeCode = employeeIdCol >= 0 ? cleanImportedEmployeeCode(row[employeeIdCol]) : "";
    const employeeName = employeeNameCol >= 0 ? cleanImportedEmployeeName(row[employeeNameCol]) : "";
    const employeeLabel = getImportedEmployeeLabel(employeeName, employeeCode);
    if (!employeeLabel) continue;
    if (
      (employeeName && isEmployeeHeader(normalizeText(employeeName))) ||
      (employeeCode && isEmployeeHeader(normalizeText(employeeCode)))
    ) {
      continue;
    }

    let parsedDate: Date | null = null;
    let timeToken: string | undefined;

    if (dateTimeCol >= 0) {
      const parsed = parseDateTimeValue(row[dateTimeCol]);
      parsedDate = parsed.date;
      timeToken = parsed.time;
    } else {
      parsedDate = dateCol >= 0 ? parseDateValue(row[dateCol]) : null;
      timeToken = timeCol >= 0 ? extractTimeTokens(row[timeCol])[0] : undefined;
    }

    if (!parsedDate && !timeToken && row.every((cell) => !cleanName(cell))) {
      continue;
    }

    if (!parsedDate) {
      errors.push(`Fila ${rowIndex + 1}: no se pudo interpretar la fecha de la marcacion.`);
      continue;
    }

    if (!timeToken) {
      continue;
    }

    const dateKey = format(parsedDate, "yyyy-MM-dd");
    const key = `${employeeCode || employeeLabel}|${dateKey}`;
    const current = grouped.get(key) ?? {
      employeeName: employeeLabel,
      employeeCode: employeeCode || undefined,
      dateKey,
      times: [],
      sourceRow: rowIndex + 1,
      local: undefined,
      parcelaName: undefined,
      jobType: undefined,
      pricePerHourGs: undefined,
    };

    if (!current.employeeCode && employeeCode) {
      current.employeeCode = employeeCode;
    }
    current.times.push(timeToken);
    if (!current.local && localCol >= 0) {
      const local = cleanName(row[localCol]);
      current.local = local || undefined;
    }
    if (!current.parcelaName && parcelaCol >= 0) {
      const parcela = cleanName(row[parcelaCol]);
      current.parcelaName = parcela || undefined;
    }
    if (!current.jobType && jobTypeCol >= 0) {
      const jobType = cleanName(row[jobTypeCol]);
      current.jobType = jobType || undefined;
    }
    if (!current.pricePerHourGs && priceCol >= 0) {
      current.pricePerHourGs = parseGsAmount(row[priceCol]) ?? undefined;
    }

    grouped.set(key, current);
  }

  const records: ParsedBiometricRecord[] = [];
  grouped.forEach((group) => {
    const sortedTimes = [...new Set(group.times)].sort((a, b) => a.localeCompare(b));
    const employeeLabel = getImportedEmployeeLabel(group.employeeName, group.employeeCode);
    if (sortedTimes.length % 2 !== 0) {
      errors.push(
        `Fila ${group.sourceRow}: marcacion incompleta para ${employeeLabel} el ${format(
          new Date(group.dateKey),
          "dd/MM/yyyy"
        )}.`
      );
    }

    const intervals = pairTimeTokens(sortedTimes);
    if (intervals.length === 0) return;

    records.push({
      employeeName: employeeLabel,
      employeeCode: group.employeeCode,
      dateKey: group.dateKey,
      intervals,
      sourceRow: group.sourceRow,
      local: group.local,
      parcelaName: group.parcelaName,
      jobType: group.jobType,
      pricePerHourGs: group.pricePerHourGs,
    });
  });

  return { format: "log", records, errors };
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
  let employeeIdColumnIndex = -1;
  let employeeNameColumnIndex = -1;

  for (let index = 0; index < rows.length && index <= 40; index++) {
    const row = rows[index];
    const normalized = row.map(normalizeText);
    const dayCount = row.reduce<number>((count, value, col) => {
      if (col === 0) return count;
      return parseMatrixDay(value) !== null ? count + 1 : count;
    }, 0);
    if (dayCount < 2) continue;

    const hasFechaToken = normalized.some((cell) => isDateHeader(cell));
    const hasNombreToken = normalized.some((cell) => isEmployeeHeader(cell));
    if (!hasFechaToken && !hasNombreToken) continue;

    dateRowIndex = index;
    employeeIdColumnIndex = findEmployeeIdColumn(normalized);
    employeeNameColumnIndex = findEmployeeNameColumn(normalized);
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
    const employeeCode =
      employeeIdColumnIndex >= 0 ? cleanImportedEmployeeCode(row[employeeIdColumnIndex]) : "";
    const employeeName =
      employeeNameColumnIndex >= 0 ? cleanImportedEmployeeName(row[employeeNameColumnIndex]) : "";
    const employeeLabel = getImportedEmployeeLabel(employeeName, employeeCode);
    if (!employeeLabel) continue;
    if (employeeName && normalizeText(employeeName).includes("nombre")) continue;
    if (employeeCode && isEmployeeIdHeader(normalizeText(employeeCode))) continue;

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
        employeeName: employeeLabel,
        employeeCode: employeeCode || undefined,
        dateKey: format(date, "yyyy-MM-dd"),
        intervals,
        sourceRow: rowIndex + 1,
      });
    }
  }

  return { format: "matrix", records, errors };
}

function getCardEmployeeIdentity(row: unknown[]): { employeeCode?: string; employeeName: string } {
  const cells = row
    .map((value, index) => ({ index, raw: cleanName(value) }))
    .filter((cell) => cell.raw.length > 0);

  if (cells.length === 0) {
    return { employeeName: "" };
  }

  const codeCell = cells.find((cell) => looksLikeEmployeeCode(cell.raw));
  const employeeCode = codeCell ? cleanImportedEmployeeCode(codeCell.raw) : "";
  const employeeName =
    cells
      .filter((cell) => cell.index !== codeCell?.index)
      .map((cell) => cleanImportedEmployeeName(cell.raw))
      .find((value) => hasLetters(value)) || employeeCode;

  return {
    employeeCode: employeeCode || undefined,
    employeeName,
  };
}

function isCardEmployeeRow(rows: unknown[][], rowIndex: number): boolean {
  const row = rows[rowIndex];
  const identity = getCardEmployeeIdentity(row ?? []);
  if (!identity.employeeCode && !identity.employeeName) return false;

  const nextRow = rows[rowIndex + 1] ?? [];
  return extractStandaloneDateColumns(nextRow).length >= 2;
}

function findCardLocal(rows: unknown[][], employeeRowIndex: number): string | undefined {
  for (let rowIndex = employeeRowIndex - 1; rowIndex >= 0 && rowIndex >= employeeRowIndex - 3; rowIndex--) {
    const row = rows[rowIndex] ?? [];
    const firstCell = cleanName(row[0]);
    if (!firstCell) continue;
    if (isCardEmployeeRow(rows, rowIndex)) break;
    if (extractStandaloneDateColumns(row).length > 0) continue;
    if (countNonEmptyCells(row) === 1) {
      return firstCell;
    }
  }

  return undefined;
}

function parseCardFormat(rows: unknown[][]): BiometricParseResult | null {
  const records: ParsedBiometricRecord[] = [];
  const errors: string[] = [];
  let foundEmployeeBlock = false;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    if (!isCardEmployeeRow(rows, rowIndex)) continue;

    foundEmployeeBlock = true;
    const identity = getCardEmployeeIdentity(rows[rowIndex] ?? []);
    const employeeLabel = getImportedEmployeeLabel(identity.employeeName, identity.employeeCode);
    const local = findCardLocal(rows, rowIndex);

    let cursor = rowIndex + 1;
    while (cursor < rows.length) {
      if (cursor !== rowIndex + 1 && isCardEmployeeRow(rows, cursor)) {
        break;
      }

      const dateColumns = extractStandaloneDateColumns(rows[cursor] ?? []);
      if (dateColumns.length === 0) {
        cursor += 1;
        continue;
      }

      const punchRowIndex = cursor + 3;
      const punchRow = rows[punchRowIndex] ?? [];

      dateColumns.forEach(({ col, date }) => {
        const tokens = extractTimeTokens(punchRow[col]);
        if (tokens.length === 0) return;

        const intervals = pairTimeTokens(tokens);
        if (tokens.length % 2 !== 0) {
          errors.push(
            `Fila ${punchRowIndex + 1}: marcacion incompleta para ${employeeLabel} el ${format(
              date,
              "dd/MM/yyyy"
            )}.`
          );
        }

        if (intervals.length === 0) return;

        records.push({
          employeeName: employeeLabel,
          employeeCode: identity.employeeCode,
          dateKey: format(date, "yyyy-MM-dd"),
          intervals,
          sourceRow: punchRowIndex + 1,
          local,
        });
      });

      cursor += 5;
    }

    rowIndex = cursor - 1;
  }

  if (!foundEmployeeBlock) return null;
  return { format: "card", records, errors };
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

    const punchLog = parsePunchLogFormat(rows);
    if (punchLog) {
      if (punchLog.records.length > 0) {
        candidates.push({ ...punchLog, sheetName });
      } else if (punchLog.errors.length > 0) {
        allErrors.push(...punchLog.errors.map((e) => `[${sheetName}] ${e}`));
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

    const card = parseCardFormat(rows);
    if (card) {
      if (card.records.length > 0) {
        candidates.push({ ...card, sheetName });
      } else if (card.errors.length > 0) {
        allErrors.push(...card.errors.map((e) => `[${sheetName}] ${e}`));
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
  return normalizeText(expandCompactWords(value)).replace(/\s+/g, " ").trim();
}
