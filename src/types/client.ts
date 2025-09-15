export interface Client {
  id: string;
  fullName: string;
  code?: string;
  grade?: string;
  classroom?: string;
  level?: "primaria" | "secundaria";
  isTeacher?: boolean;
  isStaff?: boolean;
  phone1?: string;
  phone2?: string;

  /** puede comprar a crédito */
  accountEnabled?: boolean;

  /** estado del cliente (activo) */
  active?: boolean;

  responsible1?: { name: string; phone?: string };
  responsible2?: { name: string; phone?: string };

  // si no usas estos, puedes quitarlos
  creditLimit?: number;
  balance?: number;

  createdAt?: number;
  updatedAt?: number;
}
