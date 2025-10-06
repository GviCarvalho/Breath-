import type { } from 'react';

export type Preset = { name: string; seed: string };

export const PRESET_KEY = 'breath-deck-presets-v1';

// Import the raw text with Vite's ?raw loader
// Each line should be in the format: "Name: v1.xxx"
// Non-matching lines are ignored.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite raw import
import katasText from '../../docs/kata_seeds.txt?raw';

function parseLine(line: string): Preset | null {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  const name = line.slice(0, idx).trim();
  const seed = line.slice(idx + 1).trim();
  if (!name || !seed || !seed.startsWith('v1.')) return null;
  return { name, seed };
}

export function getAllKatas(): Preset[] {
  try {
    const lines = String(katasText || '').split(/\r?\n/);
    const arr: Preset[] = [];
    for (const ln of lines) {
      const p = parseLine(ln);
      if (p) arr.push(p);
    }
    return arr;
  } catch {
    return [];
  }
}

export function getBeginnerKata(): Preset | null {
  const all = getAllKatas();
  const found = all.find((p) => p.name.toLowerCase().includes('kata do iniciante'));
  return found || null;
}

export function loadPresetsFromStorage(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((p) => p && typeof p.name === 'string' && typeof p.seed === 'string');
  } catch {
    return [];
  }
}

export function savePresetsToStorage(arr: Preset[]): void {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(arr));
  } catch {}
}

// Ensure the player's presets include the Beginner kata on a fresh profile
export function seedPresetsIfNeeded(existing?: Preset[]): Preset[] {
  const current = existing && Array.isArray(existing) ? existing.slice() : loadPresetsFromStorage();
  if (current.length > 0) return current;
  const beginner = getBeginnerKata();
  if (beginner) {
    const seeded = [beginner];
    savePresetsToStorage(seeded);
    return seeded;
  }
  return current;
}

