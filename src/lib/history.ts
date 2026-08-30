import type { Recipe } from "./recipes";

export interface HistoryItem {
  name: string;
  timeMin: number;
  difficulty: number;
  used: string[];
  missing: { name: string; qty: string }[];
  steps: string[];
  tips?: string | null;
  cookedAt: string; // ISO 时间
}

const KEY = "fridge.history.v1";
const MAX_ITEMS = 20;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (x): x is HistoryItem =>
        !!x &&
        typeof x === "object" &&
        typeof (x as HistoryItem).name === "string" &&
        typeof (x as HistoryItem).cookedAt === "string",
    );
  } catch {
    return [];
  }
}

export function addHistory(recipe: Recipe): HistoryItem[] {
  const item: HistoryItem = {
    name: recipe.name,
    timeMin: recipe.timeMin,
    difficulty: recipe.difficulty,
    used: recipe.used,
    missing: recipe.missing,
    steps: recipe.steps,
    tips: recipe.tips ?? null,
    cookedAt: new Date().toISOString(),
  };
  const next = [item, ...loadHistory().filter((x) => x.name !== item.name)].slice(0, MAX_ITEMS);
  save(next);
  return next;
}

export function removeHistory(name: string): HistoryItem[] {
  const next = loadHistory().filter((x) => x.name !== name);
  save(next);
  return next;
}

function save(list: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 同上，静默失败
  }
}
