import type { AppDatabase } from '@/types';
import { buildSeedDatabase } from './seed-data';

const DB_KEY = 'mm_chart_db_v2';

export function loadDatabase(): AppDatabase {
  if (typeof window === 'undefined') {
    return buildSeedDatabase();
  }
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      return JSON.parse(raw) as AppDatabase;
    }
  } catch {
    // corrupted data – reset
  }
  const seed = buildSeedDatabase();
  saveDatabase(seed);
  return seed;
}

export function saveDatabase(db: AppDatabase): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export function clearDatabase(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DB_KEY);
}
