export type SupplyUnit = 'KG' | 'L' | 'PIECE' | 'BOITE' | 'SACHET' | 'AUTRE';

export interface SupplyItem {
  id: string;
  name: string;
  unit: SupplyUnit;
  current_stock: number;
  min_stock: number;
  created_at: number;
  updated_at: number;
}

export interface SupplyEntry {
  id: string;
  supply_item_id: string;
  supply_item_name: string;
  quantity: number;
  unit: SupplyUnit;
  cost: number;
  date: number;
  created_at: number;
}

export interface DailySupply {
  id: string;
  date: number;
  total_cost: number;
  items: SupplyEntry[];
  created_at: number;
}

export const unitLabels: Record<SupplyUnit, string> = {
  KG: 'Kilogramme (kg)',
  L: 'Litre (L)',
  PIECE: 'Pièce',
  BOITE: 'Boîte',
  SACHET: 'Sachet',
  AUTRE: 'Autre',
};

export const unitShortLabels: Record<SupplyUnit, string> = {
  KG: 'kg',
  L: 'L',
  PIECE: 'pce',
  BOITE: 'bt',
  SACHET: 'sct',
  AUTRE: 'autre',
};
