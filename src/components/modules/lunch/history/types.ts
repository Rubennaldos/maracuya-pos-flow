export interface HistoryOrder {
  id: string;
  code?: string;
  clientCode?: string;
  clientName?: string;
  studentName?: string;
  recess?: string;
  status: "pending" | "preparing" | "ready" | "delivered" | "canceled";
  total: number;
  items: Array<{
    qty: number;
    name: string;
    price?: number;
  }>;
  note?: string;
  createdAt: number | string;
  deliveryAt?: string;
  selectedDays?: string[]; // For varied products
  orderDate: string; // YYYY-MM-DD format for the day this order is for
}

export interface DayOrders {
  date: string; // YYYY-MM-DD
  orders: HistoryOrder[];
  totalOrders: number;
  totalAmount: number;
}

export interface OrderFilter {
  dateFrom: string;
  dateTo: string;
  clientName?: string;
  status?: string;
  groupBy: "day" | "week" | "month";
}

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