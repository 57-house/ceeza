export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  created_at: number;
  updated_at: number;
}

