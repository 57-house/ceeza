import { Order } from './order';

export type InvoiceStatus = 'PENDING' | 'PAID';

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
};

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  table_number: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  created_at: number;
  paid_at: number | null;
}

export interface InvoiceWithOrder extends Invoice {
  order: Order;
}
