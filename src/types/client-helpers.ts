import type { Client } from "./client";

/** Nombre para mostrar */
export function getClientDisplayName(c?: Client | { id: string; name?: string } | string | null): string {
  if (!c) return "Cliente Varios";
  if (typeof c === "string") return c;
  // si viene del editor como {id, name}
  // o de RTDB como Client con fullName
  return (c as any).fullName || (c as any).name || "Cliente Varios";
}

/** ¿Tiene cuenta a crédito?  (antes: hasCreditAccount) */
export function clientHasCredit(c?: Client | null): boolean {
  if (!c) return false;
  return !!c.accountEnabled;
}

/** ¿Está activo?  (antes: isActive) */
export function clientIsActive(c?: Client | null): boolean {
  if (!c) return false;
  return c.active !== false; // por defecto true si no está definido
}

/** Devuelve {id, name} para props de componentes como SalesEditor */
export function toIdName(c?: Client | { id: string; name?: string } | string | null): { id: string; name: string } {
  if (!c) return { id: "varios", name: "Cliente Varios" };
  if (typeof c === "string") return { id: "varios", name: c };
  return {
    id: (c as any).id ?? "varios",
    name: (c as any).fullName || (c as any).name || "Cliente Varios",
  };
}
