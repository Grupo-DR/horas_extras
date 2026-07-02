import { Project, RDOData, ServiceItem } from './types';

export const formatMoney = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const parseDate = (dateStr: string) => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const parseExcelDate = (val: any): string | undefined => {
  if (!val) return undefined;
  if (typeof val === 'number') {
    // Excel date serial number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    // Attempt DD/MM/YYYY
    const parts = val.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${y}-${m}-${d}`;
    }
    // Attempt YYYY-MM-DD
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return val;
    }
  }
  return undefined;
};

export const isDateInRange = (dateToCheck: string, startDate?: string, endDate?: string): boolean => {
  let date = dateToCheck;
  if (date.includes('/')) {
    const parts = date.split('/');
    if (parts.length === 3) {
      date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

export const getServiceByCode = (project: Project, code: string): ServiceItem | undefined => {
  if (!project.services) return undefined;
  return project.services.find(s => s.code.trim() === code.trim());
};

export const calculateRDOTotal = (rdo: RDOData, project?: Project) => {
  if (!project || !project.services) return 0;
  let total = 0;
  rdo.activities.forEach(act => {
    if (act.code && act.quantity) {
      const service = getServiceByCode(project, act.code);
      if (service) {
        total += service.value * act.quantity;
      }
    }
  });
  return total;
};

/**
 * Generates a UUID v4.
 * Includes a fallback for non-secure contexts (HTTP/IP) where crypto.randomUUID is unavailable.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
