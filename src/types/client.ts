export interface Client {
  id: string;
  name?: string;
  names?: string;
  lastNames?: string;
  fullName?: string;
  grade?: string;
  section?: string;
  hasCreditAccount?: boolean;
  isActive?: boolean;
  creditLimit?: number;
  currentDebt?: number;
}