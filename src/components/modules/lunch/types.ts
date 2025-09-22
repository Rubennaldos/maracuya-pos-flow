// src/components/modules/lunch/types.ts

export type SettingsT = {
  isOpen?: boolean;
  showPrices?: boolean;
  cutoffTime?: string;
  allowSameDay?: boolean;
  orderWindow?: { start?: string; end?: string };

  // ===== NUEVO: metadatos de versión / actualización (opcional) =====
  version?: string;      // ej. "1.2.3"
  updateSeq?: number;    // correlativo incremental
  updatedAt?: number;    // timestamp en ms

  // ===== NUEVO: WhatsApp para notificación al confirmar pedido =====
  whatsapp?: {
    enabled?: boolean;   // si true, abrir WhatsApp con el resumen
    phone?: string;      // solo dígitos, ej: "51987654321"
  };
};

export type CategoryT = { id: string; name: string; order?: number };

export type Course = "entrada" | "segundo" | "postre";

export type ProductT = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  description?: string;
  image?: string; // data URL webp opcional
  active?: boolean;

  // Ordenamiento
  /** Preferente: posición persistida (puede venir como string desde RTDB) */
  position?: number | string;
  /** Compatibilidad antiga si usabas 'order' en productos */
  order?: number | string;

  course?: Course;
  isCombo?: boolean;
  components?: {
    entradaId?: string | null;
    segundoId?: string | null;
    postreId?: string | null;
    bebidaLabel?: string | null;
  };
};

export type MenuT = {
  categories?: Record<string, CategoryT>;
  products?: Record<string, ProductT>;
};

export type Recess = "primero" | "segundo";

export type OrderItem = {
  id?: string;          // id del producto (opcional)
  name: string;
  price: number;
  qty: number;
  isCombo?: boolean;
};

export type OrderT = {
  id: string;
  code: string;         // correlativo legible (A001-00001)
  clientCode: string;   // id/código del padre
  clientName: string;
  items: OrderItem[];
  note?: string;
  total: number;
  status: "pending" | "preparing" | "delivered" | "canceled" | "confirmed" | "ready";
  createdAt: number;    // 👈 SIEMPRE número (ms)
  deliveryAt?: string;

  // extras del portal
  recess?: Recess;
  studentName?: string;
};

export type ComboTemplate = {
  id: string;
  name: string;
  title?: string | null;
  entrada?: string | null;
  segundo: string;
  postre?: string | null;
  bebidaLabel?: string | null;
  price: number;
  categoryId?: string | null;
  image?: string | null; // data URL webp
};

/* ===== NUEVO: tipo para Promociones del módulo de almuerzos ===== */
export type PromoT = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  active?: boolean;
  // opcional: vigencia
  startAt?: number; // timestamp ms
  endAt?: number;   // timestamp ms
};
