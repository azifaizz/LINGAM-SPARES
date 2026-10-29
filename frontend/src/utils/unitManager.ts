// src/utils/unitManager.ts
import { useState, useEffect, useMemo } from 'react';

export const DEFAULT_UNIT_OPTIONS = [
  "kg", "pcs", "Nos", "gms", "mtrs", "ltrs", "packs", "boxes",
  "bundles", "rolls", "jars", "bottles", "cans", "tins",
  "bags", "sacks", "drums", "cartons", "pallets", "containers"
];

export const CUSTOM_UNITS_KEY = "lingam_custom_units_v1";
export const CUSTOM_UNITS_EVENT = "lingam_custom_units_updated";

/**
 * Retrieve saved custom units from local storage
 */
export function getCustomUnits(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(u => typeof u === 'string' && u.trim().length > 0);
      }
    }
  } catch (e) {
    console.warn("Failed to read custom units from localStorage:", e);
  }
  return [];
}

/**
 * Save custom units to local storage and broadcast change
 */
export function saveCustomUnits(units: string[]): void {
  try {
    const clean = Array.from(new Set(units.map(u => u.trim()).filter(Boolean)));
    localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent(CUSTOM_UNITS_EVENT, { detail: clean }));
  } catch (e) {
    console.error("Failed to save custom units:", e);
  }
}

/**
 * Get all available unit options (defaults + custom)
 */
export function getAllUnitOptions(): string[] {
  const custom = getCustomUnits();
  return Array.from(new Set([...DEFAULT_UNIT_OPTIONS, ...custom]));
}

/**
 * React hook to manage custom units with automatic cross-component synchronization
 */
export function useCustomUnits() {
  const [customUnits, setCustomUnits] = useState<string[]>(() => getCustomUnits());

  useEffect(() => {
    const handleUpdate = () => {
      setCustomUnits(getCustomUnits());
    };

    window.addEventListener(CUSTOM_UNITS_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(CUSTOM_UNITS_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const addUnit = (unit: string): { success: boolean; message: string } => {
    const trimmed = unit.trim();
    if (!trimmed) {
      return { success: false, message: "Unit cannot be empty." };
    }
    const lower = trimmed.toLowerCase();
    if (DEFAULT_UNIT_OPTIONS.some(u => u.toLowerCase() === lower)) {
      return { success: false, message: `"${trimmed}" already exists in standard units.` };
    }
    if (customUnits.some(u => u.toLowerCase() === lower)) {
      return { success: false, message: `"${trimmed}" is already added in custom units.` };
    }
    const updated = [...customUnits, trimmed];
    saveCustomUnits(updated);
    setCustomUnits(updated);
    return { success: true, message: `Unit "${trimmed}" added successfully.` };
  };

  const removeUnit = (unit: string) => {
    const updated = customUnits.filter(u => u.toLowerCase() !== unit.toLowerCase());
    saveCustomUnits(updated);
    setCustomUnits(updated);
  };

  const allUnits = useMemo(() => {
    return Array.from(new Set([...DEFAULT_UNIT_OPTIONS, ...customUnits]));
  }, [customUnits]);

  return {
    customUnits,
    allUnits,
    defaultUnits: DEFAULT_UNIT_OPTIONS,
    addUnit,
    removeUnit
  };
}
