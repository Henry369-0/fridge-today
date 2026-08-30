import { z } from "zod";

// ── 调用 2（文本模型）：prompt 版本 + zod schema + 忌口/防编造的程序化复查 ──
// 这个文件被客户端组件引用（类型与纯函数），绝不能 import 服务端的 llm.ts。

export const RECIPES_PROMPT_VERSION = "v1.0";

export const PRESET_TABOOS = ["香菜", "辣", "海鲜", "花生", "鸡蛋", "牛奶", "菌菇", "豆制品"] as const;

export const TASTE_OPTIONS = ["家常", "清淡", "下饭", "重口", "减脂"] as const;

export const TOOL_OPTIONS = ["电饭煲", "空气炸锅", "微波炉", "烤箱"] as const;

export const missingItemSchema = z.object({
  name: z.string().min(1).max(24),
  qty: z.string().min(1).max(24),
});

export const recipeSchema = z.object({
  name: z.string().min(1).max(30),
  timeMin: z.number().int().min(1).max(240),
  difficulty: z.number().int().min(1).max(3),
  used: z.array(z.string().min(1).max(24)).max(30).default([]),
  missing: z.array(missingItemSchema).max(30).default([]),
  steps: z.array(z.string().min(1).max(300)).min(1).max(24),
  tips: z.string().max(300).nullable().optional(),
});

export const recipesResultSchema = z.object({
  recipes: z.array(recipeSchema).min(1).max(6),
});

export type MissingItem = z.infer<typeof missingItemSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

export interface PrefsInput {
  taboos: string[];
  taste: string | null;
  tools: string[];
  quickMode: boolean;
}

export const recipeSystemPrompt = `你是家常菜规划师「冰箱食堂」。
用户会给你一份"现有食材"清单（已由用户逐项确认过），以及可选偏好（忌口/口味/厨具/快手模式）。

铁律：
1. 只使用"现有食材"里的东西设计菜谱；需要额外购买的材料必须单列在 missing 里并给出参考用量，绝不假装现有。
2. 基础调味料（食盐、食用油、白糖、生抽、老抽、香醋、料酒、淀粉、黑胡椒、蚝油、香油）视为家中常备：步骤里可以直接用，但既不列入 used 也不列入 missing。
3. 忌口是硬约束：忌口食材（含其同义词，如忌"海鲜"则虾蟹贝鱼都不能用）绝对不能出现在任何菜谱的菜名、used、missing、steps、tips 里，违反即失败。
4. used 只能写"现有食材"清单里出现过的名字；steps 里出现的主料必须在 used 或 missing 里。

输出 JSON（不要解释、不要 markdown 标记）：
{"recipes":[{"name":"菜名","timeMin":15,"difficulty":1,"used":["只用现有食材里的名字"],"missing":[{"name":"缺的料","qty":"参考用量"}],"steps":["第一步","第二步"],"tips":"一句话小贴士，可为 null"}]}

要求：
- 恰好 3 个菜谱，按 timeMin 升序排列；三个菜尽量主料/做法不同。
- difficulty：1=拌煮蒸这类不用动勺的，2=常规炒，3=要点功夫。
- timeMin 是实际动手加等待的总分钟数。`;

export function buildRecipeUserPrompt(ingredients: string[], prefs: PrefsInput): string {
  const prefLines: string[] = [];
  if (prefs.taboos.length > 0) {
    prefLines.push(`忌口（硬约束，任何菜谱绝对不能包含）：${prefs.taboos.join("、")}`);
  }
  if (prefs.taste) {
    prefLines.push(`口味偏好：${prefs.taste}`);
  }
  prefLines.push(
    prefs.tools.length > 0
      ? `厨具有限：除燃气灶和基础锅具外，只有 ${prefs.tools.join("、")}，不要用到列表之外的设备`
      : "厨具齐全（燃气灶 + 基础锅具）",
  );
  prefLines.push(
    prefs.quickMode ? "快手模式：开启，所有菜谱 timeMin 必须 ≤ 20" : "快手模式：关闭",
  );
  return [
    `现有食材（用户已逐项确认过）：${ingredients.join("、")}`,
    "偏好：",
    ...prefLines.map((l) => `- ${l}`),
    "",
    "请给出 3 个菜谱，只输出 JSON。",
  ].join("\n");
}

// ── 程序化复查：prompt 约束之外的代码兜底 ──

// 基础调味料视为常备：不进 used、不进 missing（v2 的"常备清单"会把它做成可配置）
export const PANTRY_STAPLES = new Set([
  "盐", "食盐",
  "食用油", "油", "色拉油", "花生油", "菜籽油", "橄榄油",
  "糖", "白糖", "白砂糖", "绵白糖", "冰糖",
  "生抽", "老抽", "酱油", "味极鲜",
  "醋", "香醋", "米醋", "陈醋",
  "料酒", "黄酒",
  "淀粉", "生粉",
  "黑胡椒", "白胡椒", "胡椒粉",
  "味精", "鸡精", "蚝油", "香油", "芝麻油", "麻油",
]);

// 常见形态后缀："葱"→"葱花"、"姜"→"姜丝" 算同一种食材；"番茄"→"番茄酱"不算
const FORM_SUFFIXES = new Set(["丝", "片", "丁", "块", "末", "段", "花", "蓉", "条", "粒", "泥", "液"]);

export function itemAvailable(item: string, existing: string[]): boolean {
  const a = item.trim();
  if (!a) return false;
  for (const b of existing) {
    const bb = b.trim();
    if (!bb) continue;
    if (bb === a) return true;
    if (bb.includes(a)) return true; // 清单更具体（清单"小葱"，菜谱写"葱"）
    if (a.includes(bb) && a.length - bb.length <= 2) {
      const extra = a.slice(bb.length);
      if ([...extra].every((ch) => FORM_SUFFIXES.has(ch))) return true;
    }
  }
  return false;
}

// 忌口同义词表：子串命中即算违反（宁可错杀不可放过，这是安全红线）
const TABOO_KEYWORDS: Record<string, string[]> = {
  香菜: ["香菜", "芫荽", "胡荽"],
  辣: ["辣"],
  海鲜: ["海鲜", "虾", "蟹", "贝", "蛤", "蛏", "蚝", "鱿鱼", "章鱼", "墨鱼", "海参", "紫菜", "海带", "鱼"],
  花生: ["花生"],
  鸡蛋: ["鸡蛋", "蛋"],
  牛奶: ["牛奶", "奶油", "奶酪", "芝士", "黄油", "奶"],
  菌菇: ["菌菇", "菇", "木耳", "银耳", "竹荪"],
  豆制品: ["豆腐", "豆干", "豆皮", "腐竹", "豆浆", "豆花", "千张"],
};

export function findTaboo(text: string, taboos: string[]): string | null {
  const t = text.toLowerCase();
  for (const taboo of taboos) {
    const keywords = TABOO_KEYWORDS[taboo] ?? [taboo];
    for (const kw of keywords) {
      if (t.includes(kw.toLowerCase())) return taboo;
    }
  }
  return null;
}

export interface ReviewOutput {
  recipes: Recipe[];
  issues: string[];
}

export function reviewRecipes(
  candidates: Recipe[],
  existing: string[],
  prefs: PrefsInput,
): ReviewOutput {
  const ok: Recipe[] = [];
  const issues: string[] = [];
  const seenNames = new Set<string>();
  for (const r of candidates) {
    const problems: string[] = [];

    const blob = [
      r.name,
      ...r.used,
      ...r.missing.map((m) => `${m.name}${m.qty}`),
      ...r.steps,
      r.tips ?? "",
    ].join("\n");
    const taboo = findTaboo(blob, prefs.taboos);
    if (taboo) problems.push(`出现忌口「${taboo}」`);
    if (prefs.quickMode && r.timeMin > 20) {
      problems.push(`耗时 ${r.timeMin} 分钟超过快手模式上限 20`);
    }

    const used: string[] = [];
    for (const u of r.used) {
      const name = u.trim();
      if (!name) continue;
      if (PANTRY_STAPLES.has(name)) continue;
      if (itemAvailable(name, existing)) {
        if (!used.includes(name)) used.push(name);
      } else {
        problems.push(`用到了现有清单里没有的「${name}」`);
      }
    }

    const missing: MissingItem[] = [];
    for (const m of r.missing) {
      const name = m.name.trim();
      if (!name) continue;
      if (PANTRY_STAPLES.has(name)) continue;
      if (itemAvailable(name, existing)) {
        // 模型把已有的料写成缺的 → 自动纠正为 used
        if (!used.includes(name)) used.push(name);
      } else {
        missing.push({ name, qty: m.qty });
      }
    }

    if (seenNames.has(r.name.trim())) problems.push("和其他菜谱重名");

    if (problems.length > 0) {
      issues.push(`「${r.name}」${problems.join("、")}`);
      continue;
    }
    seenNames.add(r.name.trim());
    ok.push({ ...r, name: r.name.trim(), used, missing, tips: r.tips?.trim() || undefined });
  }
  return { recipes: ok, issues };
}

// ── 购物清单：三张卡的 missing 合并去重 ──

export interface ShoppingItem {
  name: string;
  qty: string;
  from: string[];
}

export function mergeMissing(recipes: Recipe[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const r of recipes) {
    for (const m of r.missing) {
      const key = m.name.trim();
      const found = map.get(key);
      if (found) {
        found.qty = addQty(found.qty, m.qty);
        if (!found.from.includes(r.name)) found.from.push(r.name);
      } else {
        map.set(key, { name: key, qty: m.qty, from: [r.name] });
      }
    }
  }
  return [...map.values()];
}

// 数量合并：能按"数字+单位"相加的就相加（200克 + 100克 = 300克）；不能就并列，
// 完全相同的写 ×2（半个 + 半个 → 半个 ×2，一眼看出要凑一整个）
export function addQty(a: string, b: string): string {
  const pa = parseQty(a);
  const pb = parseQty(b);
  if (pa && pb && pa.unit === pb.unit) return `${formatNum(pa.value + pb.value)}${pa.unit}`;
  return a.trim() === b.trim() ? `${a.trim()} ×2` : `${a.trim()} + ${b.trim()}`;
}

function parseQty(q: string): { value: number; unit: string } | null {
  const m = q.trim().match(/^(\d+(?:\.\d+)?)\s*([^\d].*)?$/);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: (m[2] ?? "").trim() };
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function shoppingListMarkdown(items: ShoppingItem[]): string {
  const lines = items.map((i) => `- ${i.name}（${i.qty}）— 为了：${i.from.join("、")}`);
  return [
    "# 冰箱食堂 · 采购清单",
    ...(lines.length > 0 ? lines : ["-（这顿什么都不缺）"]),
    "",
    `生成于 ${new Date().toLocaleDateString("zh-CN")} · fridge.today`,
  ].join("\n");
}
