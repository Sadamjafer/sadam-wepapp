import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, isRestricted: boolean = false): string {
  if (isRestricted) {
    return '*** ₪';
  }
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ₪`;
}

export function formatMoney(amount: number, isRestricted: boolean = false): string {
  if (isRestricted) return '***';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseInputDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date().toISOString();
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date().toISOString();
  
  const d = new Date();
  d.setFullYear(year, month - 1, day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
