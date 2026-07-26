export type Role = 'ADMIN' | 'SUPERVISOR' | 'RESTRICTED';

export interface Store {
  id: string;
  name: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  storeId: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string; // references ExpenseCategory for expenses, or 'direct' for income
  notes: string;
  date: string; // ISO string
  incomeRecordId?: string;
}

export interface IncomeRecord {
  id: string;
  storeId: string;
  date: string;
  amount: number;
  units: number;
  notes: string;
}

export interface ExpenseCategory {
  id: string;
  storeId: string;
  name: string;
}

export type ClientType = 'CLIENT' | 'SUPPLIER';

export interface Client {
  id: string;
  storeId: string;
  name: string;
  type?: ClientType;
  linkedExpenseCategoryId?: string;
}

export type ClientOpType = 'DEBT' | 'PAYMENT';

export interface ClientOperation {
  id: string;
  clientId: string;
  type: ClientOpType;
  amount: number;
  description: string;
  date: string;
  expenseTransactionId?: string;
}

export interface ProfitDeduction {
  id: string;
  storeId: string;
  amount: number;
  description: string;
  date: string;
}
