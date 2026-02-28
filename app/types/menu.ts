export type MenuCategory = 'ENTREE' | 'PLAT' | 'DESSERT' | 'BOISSON' | 'SUPPLEMENT' | 'AUTRE';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  available: boolean;
  created_at: number;
  updated_at: number;
}

export const categoryLabels: Record<MenuCategory, string> = {
  ENTREE: 'Entrée',
  PLAT: 'Plat principal',
  DESSERT: 'Dessert',
  BOISSON: 'Boisson',
  SUPPLEMENT: 'Supplément',
  AUTRE: 'Autre',
};

