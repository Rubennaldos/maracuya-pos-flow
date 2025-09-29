export function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, ""); // sólo números
  if (digits.length < 8 || digits.length > 15) return null; // rango típico WA
  return digits;
}

export function buildWaUrl(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

/** Abre en la misma pestaña (evita pop-up blockers). */
export function openWhatsAppNow(url: string) {
  window.location.assign(url);
}
