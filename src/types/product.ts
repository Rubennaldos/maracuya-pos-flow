export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  image?: string;
  isKitchen: boolean;
  category?: string;
  code?: string;
  active?: boolean;
}
