import { DailyOrderSheet, CompanyCatalogEntry } from '../types';
import { getInitialDailySheet, getTodayDateString, INITIAL_COMPANIES_CONFIG, createEmptyItem } from '../data/defaultData';

const STORAGE_PREFIX = 'gauchao_orders_';
const LAST_DATE_KEY = 'gauchao_last_date';
const COMPANY_CATALOG_KEY = 'gauchao_company_catalog';

const LEGACY_NAMES = [
  'Denis Silva', 'Rafael Roldão', 'Rafael Boldão', 'Eduardo Costa', 'Valdir Peixoto',
  'Lucas Ramos', 'Marcos Vinicius', 'Antônio Ferreira', 'Geovane Lima', 'Claudemir'
];

export const getDefaultCompanyCatalog = (): CompanyCatalogEntry[] => {
  return INITIAL_COMPANIES_CONFIG.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    defaultRowsCount: cfg.defaultRowsCount || 4,
    kitDescription: cfg.kitDescription,
    badgeColor: cfg.badgeColor || 'amber',
  }));
};

export const getCompanyCatalog = (): CompanyCatalogEntry[] => {
  try {
    const saved = localStorage.getItem(COMPANY_CATALOG_KEY);
    if (saved) {
      const parsed: CompanyCatalogEntry[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure JR Florestal is updated if it was M Florest
        const updated = parsed.map((item) => {
          if (item.id === 'm-florest' || item.name === 'M Florest') {
            return { ...item, name: 'JR Florestal' };
          }
          return item;
        });
        return updated;
      }
    }
  } catch (err) {
    console.error('Error loading company catalog:', err);
  }
  const defaults = getDefaultCompanyCatalog();
  saveCompanyCatalog(defaults);
  return defaults;
};

export const saveCompanyCatalog = (catalog: CompanyCatalogEntry[]): void => {
  try {
    localStorage.setItem(COMPANY_CATALOG_KEY, JSON.stringify(catalog));
  } catch (err) {
    console.error('Error saving company catalog:', err);
  }
};

export const upsertCompanyCatalogEntry = (entry: CompanyCatalogEntry): void => {
  const catalog = getCompanyCatalog();
  const index = catalog.findIndex((c) => c.id === entry.id || c.name.trim().toLowerCase() === entry.name.trim().toLowerCase());
  if (index >= 0) {
    catalog[index] = { ...catalog[index], ...entry };
  } else {
    catalog.push(entry);
  }
  saveCompanyCatalog(catalog);
};

export const removeCompanyCatalogEntry = (companyId: string): void => {
  const catalog = getCompanyCatalog();
  const updated = catalog.filter((c) => c.id !== companyId);
  saveCompanyCatalog(updated);
};

export const saveSheetToStorage = (sheet: DailyOrderSheet): boolean => {
  try {
    const key = `${STORAGE_PREFIX}${sheet.date}`;
    localStorage.setItem(key, JSON.stringify({ ...sheet, lastSaved: new Date().toISOString() }));
    localStorage.setItem(LAST_DATE_KEY, sheet.date);
    return true;
  } catch (err: any) {
    console.error('Error saving sheet to local storage:', err);
    if (typeof window !== 'undefined' && (err?.name === 'QuotaExceededError' || err?.code === 22)) {
      window.dispatchEvent(new CustomEvent('gauchao_storage_quota_exceeded'));
    }
    return false;
  }
};

export const loadSheetFromStorage = (date: string): DailyOrderSheet => {
  try {
    const key = `${STORAGE_PREFIX}${date}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed: DailyOrderSheet = JSON.parse(saved);
      // Ensure kitDescription and items compatibility with strict null checks
      if (parsed && Array.isArray(parsed.companies)) {
        parsed.companies = parsed.companies
          .filter((comp: any) => comp && typeof comp === 'object')
          .map((comp) => {
            const config = INITIAL_COMPANIES_CONFIG.find((c) => c.id === comp.id);
            const kitDescription = comp.kitDescription || config?.kitDescription || 'Kit de Café Contratado';
            let companyName = comp.name || 'Empresa';
            if (companyName === 'M Florest' || comp.id === 'm-florest') {
              companyName = 'JR Florestal';
            }
            const items = (comp.items || [])
              .filter((it: any) => it && typeof it === 'object')
              .map((it: any) => {
                // Clean legacy defaults (1 or initial sample 5) so all fields start clean/empty
                let cafeQty = it.cafeQty ?? '';
                if (cafeQty === 1 || cafeQty === '1') {
                  cafeQty = '';
                }
                if (cafeQty === 5 && (it.collaboratorName === 'Denis Silva' || it.collaboratorName === 'Rafael Roldão')) {
                  cafeQty = '';
                }

                let marmitaQty = it.marmitaQty ?? '';
                if (marmitaQty === 5 && (it.collaboratorName === 'Denis Silva' || it.collaboratorName === 'Rafael Roldão')) {
                  marmitaQty = '';
                }

                let collaboratorName = (it.collaboratorName || '').trim();
                if (LEGACY_NAMES.includes(collaboratorName)) {
                  collaboratorName = '';
                }

                let notes = it.notes || '';
                if (notes === 'Uma sem feijão por gentileza!!') {
                  notes = '';
                }

                // Clean legacy sample pickupTimes
                let pickupTime = it.pickupTime ?? '';
                if (['06:30', '07:00', '06:00', '06:15'].includes(pickupTime) && (!collaboratorName || LEGACY_NAMES.includes(collaboratorName))) {
                  pickupTime = '';
                }

                return {
                  id: it.id || Math.random().toString(36).substring(2, 9),
                  collaboratorName,
                  cafeQty,
                  marmitaQty,
                  marmitaType: (it.marmitaType === 'Nº 8' || it.marmitaType === 'Quadrada') ? it.marmitaType : 'Nº 9',
                  notes,
                  pickupTime,
                };
              });
            return {
              ...comp,
              name: companyName,
              kitDescription,
              items: items.length > 0 ? items : Array.from({ length: comp.defaultRowsCount || 4 }, () => createEmptyItem('')),
            };
          });
        saveSheetToStorage(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading sheet from local storage:', err);
  }

  // If none exists for this date, load customized master templates or catalog to preserve user configuration
  const initial = getInitialDailySheet();
  initial.date = date;
  initial.id = `sheet-${date}`;

  const templates = getMasterCompanyTemplates();
  if (templates && Array.isArray(templates) && templates.length > 0) {
    initial.companies = templates.map((t) => ({
      id: t.id,
      name: t.name,
      defaultRowsCount: t.defaultRowsCount || 4,
      kitDescription: t.kitDescription || '',
      badgeColor: t.badgeColor || 'amber',
      items: Array.from({ length: t.defaultRowsCount || 4 }, () => createEmptyItem('')),
    }));
  } else {
    const catalog = getCompanyCatalog();
    if (catalog && Array.isArray(catalog) && catalog.length > 0) {
      initial.companies = catalog.map((c) => ({
        id: c.id,
        name: c.name,
        defaultRowsCount: c.defaultRowsCount || 4,
        kitDescription: c.kitDescription || '',
        badgeColor: c.badgeColor || 'amber',
        items: Array.from({ length: c.defaultRowsCount || 4 }, () => createEmptyItem('')),
      }));
    }
  }

  saveSheetToStorage(initial);
  return initial;
};

const MASTER_TEMPLATES_KEY = 'gauchao_company_templates';

export const saveMasterCompanyTemplates = (companies: { id: string; name: string; kitDescription?: string; defaultRowsCount?: number; badgeColor?: string }[]): void => {
  try {
    const templates = companies.map((c) => ({
      id: c.id,
      name: c.name,
      kitDescription: c.kitDescription || '',
      defaultRowsCount: c.defaultRowsCount || 4,
      badgeColor: c.badgeColor || 'amber',
    }));
    localStorage.setItem(MASTER_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Error saving company templates:', err);
  }
};

export const getMasterCompanyTemplates = (): Array<{ id: string; name: string; kitDescription: string; defaultRowsCount: number; badgeColor: string }> | null => {
  try {
    const saved = localStorage.getItem(MASTER_TEMPLATES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading company templates:', err);
  }
  return null;
};

export const listStoredDates = (): string[] => {
  const dates: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const date = key.replace(STORAGE_PREFIX, '');
        dates.push(date);
      }
    }
    dates.sort().reverse();
  } catch (err) {
    console.error('Error listing dates from local storage:', err);
  }
  const today = getTodayDateString();
  if (!dates.includes(today)) {
    dates.unshift(today);
  }
  return dates;
};

// Export full backup of all dates, company catalog, and templates as JSON
export const exportAllSheetsBackup = (): string => {
  const dates = listStoredDates();
  const sheets: Record<string, DailyOrderSheet> = {};
  for (const date of dates) {
    const key = `${STORAGE_PREFIX}${date}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        sheets[date] = JSON.parse(data);
      } catch (e) {
        // ignore malformed entry
      }
    }
  }
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: getCompanyCatalog(),
    templates: getMasterCompanyTemplates(),
    sheets,
  };
  return JSON.stringify(backup, null, 2);
};

// Import backup JSON with schema validation
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BACKUP_SHEETS = 90;

export const importSheetsBackup = (jsonString: string): { success: boolean; importedDates: number; error?: string } => {
  try {
    // Protect against excessively large JSON inputs
    if (jsonString.length > 5 * 1024 * 1024) {
      return { success: false, importedDates: 0, error: 'Arquivo de backup excede o tamanho máximo de 5MB.' };
    }

    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object' || !data.sheets || typeof data.sheets !== 'object') {
      return { success: false, importedDates: 0, error: 'Formato de arquivo de backup inválido.' };
    }

    // Sanitize and import catalog if present
    if (Array.isArray(data.catalog) && data.catalog.length > 0) {
      const sanitizedCatalog = data.catalog
        .slice(0, 50)
        .filter((c: any) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string')
        .map((c: any) => ({
          id: String(c.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
          name: String(c.name).slice(0, 100),
          kitDescription: String(c.kitDescription || '').slice(0, 200),
          defaultRowsCount: Math.max(1, Math.min(50, Number(c.defaultRowsCount) || 4)),
          badgeColor: String(c.badgeColor || 'amber').replace(/[^a-z0-9_-]/gi, '').slice(0, 20),
        }));
      if (sanitizedCatalog.length > 0) {
        saveCompanyCatalog(sanitizedCatalog);
      }
    }

    // Sanitize and import templates if present
    if (Array.isArray(data.templates) && data.templates.length > 0) {
      const sanitizedTemplates = data.templates
        .slice(0, 50)
        .filter((t: any) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string')
        .map((t: any) => ({
          id: String(t.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
          name: String(t.name).slice(0, 100),
          kitDescription: String(t.kitDescription || '').slice(0, 200),
          defaultRowsCount: Math.max(1, Math.min(50, Number(t.defaultRowsCount) || 4)),
          badgeColor: String(t.badgeColor || 'amber').replace(/[^a-z0-9_-]/gi, '').slice(0, 20),
        }));
      if (sanitizedTemplates.length > 0) {
        saveMasterCompanyTemplates(sanitizedTemplates);
      }
    }

    let count = 0;
    const entries = Object.entries(data.sheets).slice(0, MAX_BACKUP_SHEETS);

    for (const [date, rawSheet] of entries) {
      // Prototype pollution & path-like key check
      if (
        !date ||
        date === '__proto__' ||
        date === 'constructor' ||
        date === 'prototype' ||
        !DATE_REGEX.test(date)
      ) {
        continue;
      }

      if (!rawSheet || typeof rawSheet !== 'object') continue;
      const sheet = rawSheet as any;

      if (!Array.isArray(sheet.companies)) continue;

      // Sanitize sheet data structure before writing to storage
      const sanitizedSheet: DailyOrderSheet = {
        id: String(sheet.id || `sheet-${date}`).slice(0, 64),
        date: date,
        restaurantName: String(sheet.restaurantName || 'Gauchão').slice(0, 100),
        title: String(sheet.title || 'CONTROLE DE PEDIDOS - KITS DE CAFÉ').slice(0, 100),
        subtitle: String(sheet.subtitle || 'Gauchão Restaurante e Cozinha Industrial').slice(0, 150),
        lastSaved: new Date().toISOString(),
        companies: sheet.companies.slice(0, 50).map((comp: any) => ({
          id: String(comp?.id || `comp-${Math.random().toString(36).slice(2, 7)}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
          name: String(comp?.name || 'Empresa').slice(0, 100),
          kitDescription: String(comp?.kitDescription || '').slice(0, 200),
          defaultRowsCount: Math.max(1, Math.min(50, Number(comp?.defaultRowsCount) || 4)),
          badgeColor: String(comp?.badgeColor || 'amber').replace(/[^a-z0-9_-]/gi, '').slice(0, 20),
          whatsappGroup: String(comp?.whatsappGroup || '').slice(0, 50),
          items: Array.isArray(comp?.items)
            ? comp.items.slice(0, 100).map((it: any, itIdx: number) => ({
                id: String(it?.id || `item-${itIdx}`).slice(0, 64),
                collaboratorName: String(it?.collaboratorName || '').slice(0, 100),
                cafeQty: it?.cafeQty !== '' && it?.cafeQty !== undefined && it?.cafeQty !== null ? Math.max(0, Math.min(999, parseInt(String(it.cafeQty), 10) || 0)) : '',
                marmitaQty: it?.marmitaQty !== '' && it?.marmitaQty !== undefined && it?.marmitaQty !== null ? Math.max(0, Math.min(999, parseInt(String(it.marmitaQty), 10) || 0)) : '',
                marmitaType: String(it?.marmitaType || 'Nº 9').slice(0, 30),
                notes: String(it?.notes || '').slice(0, 300),
                pickupTime: String(it?.pickupTime || '').slice(0, 20),
              }))
            : [],
        })),
      };

      saveSheetToStorage(sanitizedSheet);
      count++;
    }

    return { success: true, importedDates: count };
  } catch (err: any) {
    return { success: false, importedDates: 0, error: err?.message || 'Erro ao processar JSON de backup.' };
  }
};
