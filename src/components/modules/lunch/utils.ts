// src/components/modules/lunch/utils/dateUtils.ts

// Devuelve "YYYY-MM-DD" en la zona horaria de Lima
export function formatDateForPeru(date: Date): string {
  // 'en-CA' formatea a YYYY-MM-DD; especificamos la timeZone para Lima
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Indica si una fecha (YYYY-MM-DD) ya pasó respecto a HOY en Lima
export function isDatePast(yyyy_mm_dd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd)) return false;

  const todayPeru = formatDateForPeru(new Date()); // YYYY-MM-DD
  // Comparación lexicográfica funciona para YYYY-MM-DD
  return yyyy_mm_dd < todayPeru;
}

/* (Opcional) utilidades que podrían serte útiles después */

// Devuelve las próximas N fechas en Lima (incluyendo hoy si includeToday=true)
export function getNextDaysPeru(n: number, includeToday = true): string[] {
  const out: string[] = [];
  const start = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + (includeToday ? i : i + 1));
    out.push(formatDateForPeru(d));
  }
  return out;
}

// Devuelve nombre corto del día en español y "dd/MM" para una fecha YYYY-MM-DD
export function prettyDayEs(yyyy_mm_dd: string): { dayName: string; ddmm: string } {
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayName = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
  }).format(date);
  const ddmm = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return { dayName, ddmm };
}
