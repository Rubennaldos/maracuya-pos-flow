// src/components/modules/lunch/history/types.ts

/** Pedido mostrado en el Historial (Admin → Almuerzos) */
export interface HistoryOrder {
  id: string;
  code?: string;
  clientCode?: string;
  clientName?: string;
  studentName?: string;
  recess?: string;
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "delivered"
    | "canceled"
    | "confirmed"; // alineado con OrderT
  total: number;
  items: Array<{
    qty: number;
    name: string;
    price?: number;
  }>;
  note?: string;
  createdAt: number | string; // timestamp ms o ISO
  deliveryAt?: string;        // ISO YYYY-MM-DD (si aplica)
  selectedDays?: string[];    // para productos "varied"
  /** Día para el que corresponde el pedido (YYYY-MM-DD) */
  orderDate: string;
}

/** Grupo de pedidos por día para el Historial */
export interface DayOrders {
  /** Día en formato YYYY-MM-DD */
  date: string;
  orders: HistoryOrder[];
  totalOrders: number;
  totalAmount: number;
}

/**
 * Filtro del Historial (Admin → Almuerzos)
 * - `day` es el filtro principal: muestra solo ese día.
 * - `clientName` y `status` filtran dentro del día.
 * - `groupBy` se mantiene por compatibilidad visual.
 * - `dateFrom`/`dateTo` quedan como OPCIONALES (legacy para Reportes).
 */
export interface OrderFilter {
  /** Día seleccionado en historial (YYYY-MM-DD). */
  day?: string | null;

  /** Búsqueda por nombre (alumno/cliente/apoderado) dentro del día. */
  clientName?: string;

  status?:
    | "pending"
    | "preparing"
    | "ready"
    | "delivered"
    | "canceled"
    | "confirmed";

  groupBy?: "day" | "week" | "month";

  /** LEGACY: usados en Reportes; en Historial se ignoran. */
  dateFrom?: string | null;
  dateTo?: string | null;
}

/** Estructura para reportes agregados (cuando corresponda) */
export interface OrderReport {
  period: string;
  totalOrders: number;
  totalAmount: number;
  ordersByStatus: Record<string, number>;
  topClients: Array<{
    name: string;
    orders: number;
    amount: number;
  }>;
}
