import { DailyOrderSheet, CompanyContract, OrderItem } from '../types';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const createEmptyItem = (defaultCafeQty: number | string = ''): OrderItem => ({
  id: generateId(),
  collaboratorName: '',
  cafeQty: defaultCafeQty,
  marmitaQty: '',
  marmitaType: 'Nº 9',
  notes: '',
  pickupTime: '',
});

export const INITIAL_COMPANIES_CONFIG: Array<{
  id: string;
  name: string;
  defaultRowsCount: number;
  kitDescription: string;
  badgeColor: string;
}> = [
  {
    id: 'agronova',
    name: 'Agronova',
    defaultRowsCount: 5,
    kitDescription: '1 Pão c/ Frios + 1 Pão c/ Manteiga + 2 Frutas/Bolo + 100ml Leite / 150ml Café',
    badgeColor: 'emerald',
  },
  {
    id: 'costa-pinto',
    name: 'Costa Pinto',
    defaultRowsCount: 4,
    kitDescription: '1 Pão c/ Frios + 100ml Leite / 200ml Café (Sem manteiga / Sem fruta)',
    badgeColor: 'cyan',
  },
  {
    id: 'agro-solution',
    name: 'Agro Solution',
    defaultRowsCount: 4,
    kitDescription: '1 Pão Francês + 1 Fruta + 100ml Leite / 150ml Café',
    badgeColor: 'teal',
  },
  {
    id: 'equilibrio-florestal',
    name: 'Equilíbrio Florestal',
    defaultRowsCount: 5,
    kitDescription: '1 Pão c/ Presunto e Queijo + 2 Frutas + 200ml Leite / 200ml Café ou Suco',
    badgeColor: 'green',
  },
  {
    id: 'geopampa',
    name: 'Geopampa',
    defaultRowsCount: 4,
    kitDescription: '1 Pão c/ Manteiga + 100ml Leite / 100ml Café (Sem fruta)',
    badgeColor: 'amber',
  },
  {
    id: 'jy',
    name: 'JY',
    defaultRowsCount: 3,
    kitDescription: '1 Pão Francês + 100ml Leite / 200ml Café (Sem fruta)',
    badgeColor: 'orange',
  },
  {
    id: 'm-florest',
    name: 'JR Florestal',
    defaultRowsCount: 4,
    kitDescription: '2 Pães + 2 Frutas + 100ml Leite / 200ml Café',
    badgeColor: 'lime',
  },
  {
    id: 'fermaq',
    name: 'Fermaq',
    defaultRowsCount: 4,
    kitDescription: '1 Pão c/ Manteiga + 1 Fruta + 100ml Leite / 200ml Café',
    badgeColor: 'blue',
  },
  {
    id: 'casa-grande',
    name: 'Casa Grande',
    defaultRowsCount: 4,
    kitDescription: '1 Pão Francês + 100ml Leite / 200ml Café (Sem fruta)',
    badgeColor: 'violet',
  },
  {
    id: 'suzano',
    name: 'Suzano',
    defaultRowsCount: 5,
    kitDescription: '1 Pão c/ Manteiga + 2 Frutas + 100ml Leite / 100ml Café / 100ml Suco',
    badgeColor: 'indigo',
  },
  {
    id: 'unidas',
    name: 'Unidas',
    defaultRowsCount: 4,
    kitDescription: '1 Pão Francês + 2 Frutas + 150ml Café / 200ml Suco',
    badgeColor: 'rose',
  },
  {
    id: 'oliveira-lima',
    name: 'Oliveira & Lima',
    defaultRowsCount: 4,
    kitDescription: '1 Pão Francês + 1 Fruta + 100ml Leite / 100ml Café',
    badgeColor: 'sky',
  },
];

export const getInitialCompanies = (): CompanyContract[] => {
  return INITIAL_COMPANIES_CONFIG.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    defaultRowsCount: cfg.defaultRowsCount,
    kitDescription: cfg.kitDescription,
    badgeColor: cfg.badgeColor,
    items: Array.from({ length: cfg.defaultRowsCount || 4 }, () => createEmptyItem('')),
  }));
};

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getInitialDailySheet = (): DailyOrderSheet => {
  return {
    id: `sheet-${getTodayDateString()}`,
    date: getTodayDateString(),
    restaurantName: 'GAUCHÃO - RESTAURANTE E COZINHA INDUSTRIAL',
    title: 'GAUCHÃO - RESTAURANTE E COZINHA INDUSTRIAL',
    subtitle: 'CAFÉ DA MANHÃ - CONTRATO COM AS EMPRESAS',
    companies: getInitialCompanies(),
    lastSaved: new Date().toISOString(),
  };
};

export const MARMITA_TYPE_OPTIONS = [
  'Nº 8',
  'Nº 9',
  'Quadrada',
];
