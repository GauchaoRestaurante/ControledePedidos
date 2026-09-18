export interface OrderItem {
  id: string;
  collaboratorName: string;
  cafeQty: number | string; // Quantidade de cafés (kits contratados)
  marmitaQty?: number | string; // Quantidade de marmitas
  marmitaType?: string; // Nº 8, Nº 9, Quadrada
  notes?: string; // Observações (ex: "Uma sem feijão por gentileza!!")
  pickupTime: string; // Horário de retirada (ex: "06:30")
}

export interface CompanyContract {
  id: string;
  name: string;
  defaultRowsCount: number;
  kitDescription: string; // Descrição do kit contratado (ex: "1 Pão c/ Frios + 1 Pão c/ Manteiga + 2 Frutas ou Bolo + 100ml Leite / 150ml Café")
  badgeColor?: string;
  whatsappGroup?: string;
  items: OrderItem[];
}

export interface CompanyCatalogEntry {
  id: string;
  name: string;
  defaultRowsCount: number;
  kitDescription: string;
  badgeColor?: string;
}

export interface DailyOrderSheet {
  id: string;
  date: string; // YYYY-MM-DD
  restaurantName: string;
  title: string;
  subtitle: string;
  companies: CompanyContract[];
  lastSaved?: string;
}

