import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJson, extractJson, llmConfig, LlmError } from "@/lib/llm";
import {
  buildVisionMessages,
  visionResultSchema,
  VISION_PROMPT_VERSION,
  VISION_RETRY_NOTE,
} from "@/lib/vision";

// 调用 1：图片 → 食材清单。Key 只存在服务端环境变量，浏览器永不接触。
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  image: z.string().startsWith("data:image/").max(7_000_000),
});

function errorResponse(e: unknown) {
  if (e instanceof LlmError) {
    const status = e.kind === "rate_limit" ? 429 : e.kind === "config" ? 500 : 502;
    return NextResponse.json({ error: e.message }, { status });
  }
  console.error("[ingredients] unexpected error:", e);
  return NextResponse.json({ error: "服务端开小差了，请再试一次。" }, { status: 500 });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockResult() {
  // 覆盖三种置信度档位：高 / 中 / 低（低的那条用来演示"？"标注）
  return {
    sceneOk: true,
    mock: true,
    promptVersion: VISION_PROMPT_VERSION,
    ingredients: [
      { name: "鸡蛋", confidence: 0.95 },
      { name: "番茄", confidence: 0.9 },
      { name: "牛奶", confidence: 0.9 },
      { name: "葱", confidence: 0.85 },
      { name: "五花肉", confidence: 0.8 },
      { name: "生抽", confidence: 0.66 },
      { name: "豆腐", confidence: 0.72 },
      { name: "青椒", confidence: 0.45 },
    ],
  };
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
    return NextResponse.json({ error: "图片数据无效：重新拍一张试试。" }, { status: 400 });
  }

  const cfg = llmConfig();
  if (cfg.mock) {
    await sleep(900);
    return NextResponse.json(mockResult());
  }

  try {
    const model = cfg.visionModel || "glm-4v-flash";
    let raw = await chatJson({
      model,
      messages: buildVisionMessages(body.data.image),
      temperature: 0.2,
      maxTokens: 800,
    });
    let parsed = visionResultSchema.safeParse(extractJson(raw));
    if (!parsed.success) {
      // 坏 JSON / 坏结构：带提醒重试一次
      raw = await chatJson({
        model,
        messages: [...buildVisionMessages(body.data.image), { role: "user", content: VISION_RETRY_NOTE }],
        temperature: 0,
        maxTokens: 800,
      });
      parsed = visionResultSchema.safeParse(extractJson(raw));
    }
    if (!parsed.success) {
      throw new LlmError("识别结果格式异常（已重试一次），再试一次吧。", "bad_response");
    }

    const seen = new Set<string>();
    const ingredients: { name: string; confidence: number }[] = [];
    for (const i of parsed.data.ingredients) {
      const name = i.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      ingredients.push({ name, confidence: i.confidence });
    }
    ingredients.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      sceneOk: parsed.data.sceneOk,
      ingredients,
      mock: false,
      promptVersion: VISION_PROMPT_VERSION,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
