import { MenuItem, MenuCategory } from './menu';
import { Table } from './table';

export type OrderStatus = 'OPEN' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED';

export const orderStatusLabels: Record<OrderStatus, string> = {
  OPEN: 'Ouverte',
  PREPARING: 'En cuisine',
  READY: 'Terminée',
  SERVED: 'Servie',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

export interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  category: MenuCategory;
  price: number;
  quantity: number;
  supplements?: OrderItem[]; // Suppléments associés à ce plat
}

export interface Order {
  id: string;
  table_id: string;
  table_number: number;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  created_at: number;
  updated_at: number;
}

export interface OrderWithTable extends Order {
  table: Table;
}




