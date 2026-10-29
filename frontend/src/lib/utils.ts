import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSixDigitId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  // If it's a full ISO string (contains T), use standard formatter
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleDateString('en-GB');
  }
  // If it's already YYYY-MM-DD, just reformat to DD/MM/YYYY
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}
