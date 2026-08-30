// 仅服务端引用（API Route / Server 组件）：密钥与端点配置绝不进入浏览器 bundle。
// OpenAI 兼容 /chat/completions 客户端 + JSON 三级容错的提取层。

export type LlmErrorKind = "config" | "rate_limit" | "network" | "bad_response";

export class LlmError extends Error {
  kind: LlmErrorKind;

  constructor(message: string, kind: LlmErrorKind) {
    super(message);
    this.kind = kind;
  }
}

export interface LlmConfig {
  baseUrl: string | undefined;
  apiKey: string | undefined;
  visionModel: string | undefined;
  textModel: string | undefined;
  mock: boolean;
}

export function llmConfig(): LlmConfig {
  return {
    baseUrl: process.env.LLM_BASE_URL?.replace(/\/+$/, ""),
    apiKey: process.env.LLM_API_KEY,
    visionModel: process.env.LLM_VISION_MODEL,
    textModel: process.env.LLM_TEXT_MODEL,
    mock: process.env.LLM_MOCK === "1",
  };
}

const DEFAULT_TIMEOUT_MS = 60_000;

// content 可能是 string（OpenAI 标准）或分段数组（部分兼容端点），统一抽成纯文本
function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text: unknown }).text)
          : "",
      )
      .join("");
  }
  return "";
}

export interface ChatOptions {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export async function chatJson({
  model,
  messages,
  temperature = 0.7,
  maxTokens = 2048,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ChatOptions): Promise<string> {
  const { baseUrl, apiKey } = llmConfig();
  if (!baseUrl || !apiKey) {
    throw new LlmError(
      "服务端还没配置模型：在 .env.local 里填好 LLM_BASE_URL 和 LLM_API_KEY（照抄 .env.example），或先设 LLM_MOCK=1 看演示。",
      "config",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages }),
      signal: controller.signal,
    });
    if (res.status === 429) {
      throw new LlmError(
        "免费额度被限流了：过几分钟再试，或者在 .env.local 里换一个端点（比如本地 Ollama）。",
        "rate_limit",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new LlmError("API Key 没通过校验：检查一下 LLM_API_KEY 是否复制完整。", "config");
    }
    if (!res.ok) {
      throw new LlmError(`模型服务返回了 ${res.status}：稍后再试一次。`, "bad_response");
    }
    const data: unknown = await res.json();
    const content = contentToText(
      (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message
        ?.content,
    );
    if (!content.trim()) throw new LlmError("模型返回了空内容，再试一次。", "bad_response");
    return content;
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new LlmError("模型响应超时了：网络可能不稳，再试一次。", "network");
    }
    throw new LlmError("连不上模型服务：检查网络和 LLM_BASE_URL 是否正确。", "network");
  } finally {
    clearTimeout(timer);
  }
}

// 三级容错（#03 经验的 zod 升级版前两级在这里）：直接 parse → 抠出最外层 {...}；再不行由调用方重试一次
export function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // fallthrough
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // fallthrough
    }
  }
  throw new LlmError("模型输出的 JSON 解析不了（已自动重试过一次）。请再点一次试试。", "bad_response");
}
