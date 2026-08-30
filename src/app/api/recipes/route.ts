import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson, extractJson, llmConfig, LlmError } from "@/lib/llm";
import {
  buildRecipeUserPrompt,
  recipeSystemPrompt,
  recipesResultSchema,
  reviewRecipes,
  RECIPES_PROMPT_VERSION,
  type PrefsInput,
  type Recipe,
} from "@/lib/recipes";

// 调用 2：确认过的食材 + 偏好 → 3 个菜谱。
// 忌口是安全红线：prompt 强约束 + reviewRecipes 程序化复查双保险，复查不过的重试一次。
export const runtime = "nodejs";
export const maxDuration = 60;

const prefsSchema = z.object({
  taboos: z.array(z.string().min(1).max(24)).max(24).default([]),
  taste: z.string().max(24).nullable().default(null),
  tools: z.array(z.string().min(1).max(24)).max(12).default([]),
  quickMode: z.boolean().default(false),
});

const bodySchema = z.object({
  ingredients: z.array(z.string().min(1).max(40)).min(1).max(80),
  prefs: prefsSchema.default({ taboos: [], taste: null, tools: [], quickMode: false }),
});

function errorResponse(e: unknown) {
  if (e instanceof LlmError) {
    const status = e.kind === "rate_limit" ? 429 : e.kind === "config" ? 500 : 502;
    return NextResponse.json({ error: e.message }, { status });
  }
  console.error("[recipes] unexpected error:", e);
  return NextResponse.json({ error: "服务端开小差了，请再试一次。" }, { status: 500 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockRecipes(quickMode: boolean): Recipe[] {
  const base: Recipe[] = [
    {
      name: "小葱拌豆腐",
      timeMin: 8,
      difficulty: 1,
      used: ["豆腐", "葱"],
      missing: [{ name: "香油", qty: "几滴" }],
      steps: ["豆腐切小块，开水烫 1 分钟捞出沥干", "撒葱花，加生抽、盐、香油拌匀", "静置 2 分钟更入味"],
      tips: "用内酯豆腐口感更嫩",
    },
    {
      name: "番茄炒蛋",
      timeMin: 12,
      difficulty: 1,
      used: ["番茄", "鸡蛋", "葱"],
      missing: [],
      steps: ["鸡蛋加少许盐打散", "热油炒蛋至凝固盛出", "番茄块下锅炒出汁，倒回鸡蛋", "加盐和一点糖翻匀，撒葱花"],
      tips: "番茄去皮口感更好",
    },
    {
      name: "青椒炒五花肉",
      timeMin: 25,
      difficulty: 2,
      used: ["青椒", "五花肉"],
      missing: [{ name: "蚝油", qty: "1 勺" }],
      steps: ["五花肉切薄片，干煸出油至微焦", "下青椒块炒出虎皮纹", "加生抽、蚝油翻匀出锅"],
      tips: "怕腻可以多煸一会儿",
    },
  ];
  if (!quickMode) return base;
  return [
    base[0],
    base[1],
    {
      name: "番茄豆腐汤",
      timeMin: 18,
      difficulty: 1,
      used: ["番茄", "豆腐", "葱"],
      missing: [],
      steps: ["番茄炒出汁后加水煮开", "豆腐块下锅煮 5 分钟", "加盐调味，撒葱花出锅"],
      tips: null,
    },
  ];
}

async function generate(
  ingredients: string[],
  prefs: PrefsInput,
): Promise<{ recipes: Recipe[]; issues: string[] }> {
  const cfg = llmConfig();
  const model = cfg.textModel || "glm-4-flash";
  const baseMessages = [
    { role: "system", content: recipeSystemPrompt },
    { role: "user", content: buildRecipeUserPrompt(ingredients, prefs) },
  ];
  const collected: Recipe[] = [];
  const issues: string[] = [];

  for (let round = 0; round < 2; round++) {
    const messages =
      round === 0
        ? baseMessages
        : [
            ...baseMessages,
            { role: "assistant", content: "（上一轮输出未通过校验）" },
            {
              role: "user",
              content: `上一轮有菜谱被程序化检查拒绝了：${issues.join("；")}。请重新输出完整的 3 个菜谱 JSON，严格避开以上所有问题。`,
            },
          ];
    const raw = await chatJson({
      model,
      messages,
      temperature: round === 0 ? 0.8 : 0.35,
      maxTokens: 2200,
    });
    const parsed = recipesResultSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      issues.push("输出不是合法 JSON / 字段不符合格式");
      continue;
    }
    const review = reviewRecipes(parsed.data.recipes, ingredients, prefs);
    for (const r of review.recipes) {
      if (!collected.some((c) => c.name === r.name)) collected.push(r);
    }
    issues.push(...review.issues);
    if (collected.length >= 3) break;
  }

  collected.sort((a, b) => a.timeMin - b.timeMin);
  return { recipes: collected.slice(0, 3), issues };
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不对。" }, { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json({ error: "请求参数不对：确认食材不能为空。" }, { status: 400 });
  }
  const ingredients = [...new Set(body.data.ingredients.map((s) => s.trim()).filter(Boolean))];

  const cfg = llmConfig();
  if (cfg.mock) {
    await sleep(1100);
    return NextResponse.json({
      recipes: mockRecipes(body.data.prefs.quickMode),
      mock: true,
      promptVersion: RECIPES_PROMPT_VERSION,
    });
  }

  try {
    const { recipes, issues } = await generate(ingredients, body.data.prefs);
    if (recipes.length === 0) {
      throw new LlmError(
        `这次生成的菜谱没通过安全复查（${issues[0] ?? "原因不明"}），再试一次吧。`,
        "bad_response",
      );
    }
    if (issues.length > 0) console.log("[recipes] filtered:", issues);
    return NextResponse.json({
      recipes,
      mock: false,
      promptVersion: RECIPES_PROMPT_VERSION,
      reviewNotes: issues,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
