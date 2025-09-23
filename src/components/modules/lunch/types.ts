// src/components/modules/lunch/types.ts

export type SettingsT = {
  isOpen?: boolean;
  showPrices?: boolean;
  cutoffTime?: string;
  allowSameDay?: boolean;
  orderWindow?: { start?: string; end?: string };

  // Metadatos opcionales (para control de despliegues/cambios)
  version?: string;
  updateSeq?: number;
  updatedAt?: number;

  // WhatsApp al confirmar pedido
  whatsapp?: {
    enabled?: boolean;
    phone?: string; // solo dígitos, ej: "51987654321"
  };
};

export type CategoryT = { id: string; name: string; order?: number };

export type Course = "entrada" | "segundo" | "postre";

/** Agregado (opcional) de un producto */
export type AddonT = {
  id?: string;        // generado en cliente/RTDB
  name: string;
  price: number;      // se normaliza a número al guardar
  active?: boolean;   // true por defecto
};

export type ProductT = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  description?: string;
  image?: string;      // data URL (webp) opcional
  active?: boolean;    // true por defecto

  // Ordenamiento
  position?: number | string; // preferido (persistido)
  order?: number | string;    // compatibilidad antigua

  // Campos de “menú del día” (combo)
  course?: Course;
  isCombo?: boolean;
  components?: {
    entradaId?: string | null;
    segundoId?: string | null;
    postreId?: string | null;
    bebidaLabel?: string | null;
  };

  // Agregados opcionales
  addons?: AddonT[];
};

export type MenuT = {
  categories?: Record<string, CategoryT>;
  products?: Record<string, ProductT>;
};

export type Recess = "primero" | "segundo";

export type OrderItem = {
  id?: string;
  name: string;
  price: number;
  qty: number;
  isCombo?: boolean;
};

export type OrderT = {
  id: string;
  code: string;        // ej: A001-00001
  clientCode: string;  // id/código del padre
  clientName: string;
  items: OrderItem[];
  note?: string;
  total: number;
  status:
    | "pending"
    | "preparing"
    | "delivered"
    | "canceled"
    | "confirmed"
    | "ready";
  createdAt: number;   // timestamp ms
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

export type PromoT = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  active?: boolean;
  // Vigencia opcional
  startAt?: number; // ms
  endAt?: number;   // ms
};
