export type PaymentMethod = "efectivo" | "transferencia" | "credito" | "yape" | "plin";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isKitchen?: boolean;
  notes?: string;
}

export interface Sale {
  id: string;
  correlative: string;
  date: string;
  cashier: string; // userId
  client?: { id: string; name: string } | null;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  type: "normal" | "scheduled" | "lunch" | "historical";
  status: "completed" | "void" | "pending";
  paid: number;
  createdBy: string;
  createdAt: string;
  origin?: "PV" | "VH";
}
