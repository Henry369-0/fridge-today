export interface Prefs {
  taboos: string[];
  taste: string | null;
  tools: string[];
  quickMode: boolean;
}

export const DEFAULT_PREFS: Prefs = { taboos: [], taste: null, tools: [], quickMode: false };

const KEY = "fridge.prefs.v1";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      taboos: Array.isArray(p.taboos) ? p.taboos.filter((x): x is string => typeof x === "string") : [],
      taste: typeof p.taste === "string" ? p.taste : null,
      tools: Array.isArray(p.tools) ? p.tools.filter((x): x is string => typeof x === "string") : [],
      quickMode: p.quickMode === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // 隐私模式等场景下静默失败，不影响主流程
  }
}
