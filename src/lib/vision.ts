import { z } from "zod";

export const VISION_PROMPT_VERSION = "v1.0";

// 视觉模型不假设支持 system role（GLM-4V 系列只保证 user/assistant 交替），全部指令写进 user 消息
export const visionUserPrompt = `你是冰箱食材识别助手。看一张照片（冰箱内部、菜篮或食材），只输出一个 JSON，不要解释、不要 markdown 代码块。

格式：
{"sceneOk": true, "ingredients": [{"name": "鸡蛋", "confidence": 0.95}]}

规则：
1. sceneOk：照片里是否真的有食材/食物。明显不是（人物、风景、宠物、电子设备等）就填 false，此时 ingredients 给空数组。
2. ingredients：列出你认出的全部食材。name 用简短中文通用名（写"番茄"，不写"红色的番茄"）；同一食材只出现一次；调味品瓶（酱油、沙拉酱）和饮料（牛奶、可乐）也算。
3. confidence 是 0 到 1 的把握值：看不清、被遮挡、靠猜的一律 ≤ 0.5。
4. 宁可标低 confidence，也不要漏报。`;

export const ingredientSchema = z.object({
  name: z.string().min(1).max(24),
  confidence: z.number().min(0).max(1),
});

export const visionResultSchema = z.object({
  sceneOk: z.boolean(),
  ingredients: z.array(ingredientSchema).max(80).default([]),
});

export type VisionResult = z.infer<typeof visionResultSchema>;

export function buildVisionMessages(imageDataUrl: string) {
  return [
    {
      role: "user",
      content: [
        { type: "text", text: visionUserPrompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
}

export const VISION_RETRY_NOTE =
  "你上一次的输出不是合法 JSON 或不符合上面的格式。请重新只输出一个符合格式要求的 JSON，不要任何其他文字。";
