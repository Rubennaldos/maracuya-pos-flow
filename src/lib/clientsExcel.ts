// src/lib/export/clientsExcel.ts
import * as XLSX from "xlsx";

/**
 * Aplana objetos anidados: {a:{b:1}} -> {"a.b":1}
 * Mantiene arrays como JSON string (puedes cambiarlo si prefieres expandirlos).
 */
export function flatten(obj: any, prefix = ""): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (Array.isArray(v)) {
      out[key] = v.length ? JSON.stringify(v) : "";
    } else {
      out[key] = v ?? "";
    }
  }
  return out;
}

/**
 * Exporta clientes a un .xlsx
 * @param clients Array de clientes (puede traer campos anidados)
 * @param filename Nombre del archivo (por defecto "clientes.xlsx")
 * @param headerMap Mapa opcional para renombrar cabeceras { "code": "Código", "grade.name":"Grado", ... }
 * @param columnOrder Orden opcional de columnas; las no listadas van al final
 */
export function exportClientsToExcel(
  clients: any[],
  filename = "clientes.xlsx",
  headerMap?: Record<string, string>,
  columnOrder?: string[]
) {
  // aplanar todas las filas y construir set de columnas
  const flat = clients.map((c) => flatten(c));
  const allKeys = new Set<string>();
  flat.forEach((row) => Object.keys(row).forEach((k) => allKeys.add(k)));

  // orden de columnas
  const keysOrdered =
    columnOrder?.length
      ? [...columnOrder, ...[...allKeys].filter((k) => !columnOrder.includes(k))]
      : [...allKeys];

  // aplicar headerMap
  const headers = keysOrdered.map((k) => headerMap?.[k] ?? k);

  // construir worksheet
  const data = [
    headers,
    ...flat.map((row) => keysOrdered.map((k) => row[k])),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // anchos bonitos
  ws["!cols"] = keysOrdered.map((k) => ({ wch: Math.max(12, Math.min(40, (headerMap?.[k] ?? k).length + 2)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, filename);
}
