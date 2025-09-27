export interface Client {
  id: string;
  fullName?: string; // compatibility
  names?: string;
  lastNames?: string;
  code?: string;
  grade?: string;
  classroom?: string;
  level?: "primaria" | "secundaria" | "Kinder" | "kinder";
  isTeacher?: boolean;
  isStaff?: boolean;
  isActive?: boolean;
  phone1?: string;
  phone2?: string;
  personalPhone?: string;

  /** puede comprar a crédito */
  accountEnabled?: boolean;
  hasAccount?: boolean;

  /** estado del cliente (activo) */
  active?: boolean;

  responsible1?: { name: string; phone?: string };
  responsible2?: { name: string; phone?: string };
  payer1Name?: string;
  payer1Phone?: string;
  payer2Name?: string;
  payer2Phone?: string;

  // si no usas estos, puedes quitarlos
  creditLimit?: number;
  balance?: number;
  debt?: number;

  createdAt?: number;
  updatedAt?: number;
}
