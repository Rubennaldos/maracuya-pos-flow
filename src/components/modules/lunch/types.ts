// src/components/modules/lunch/types.ts

export type SettingsT = {
  isOpen?: boolean;
  showPrices?: boolean;
  cutoffTime?: string;
  allowSameDay?: boolean;
  orderWindow?: { start?: string; end?: string };
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

export type OrderT = {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  items: Array<{ id: string; name: string; price: number; qty: number }>;
  note?: string;
  total: number;
  status: "pending" | "preparing" | "delivered" | "canceled" | "confirmed" | "ready";
  createdAt: string;
  deliveryAt?: string;
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
