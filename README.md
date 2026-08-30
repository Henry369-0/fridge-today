# 冰箱食堂 fridge.today

拍一张冰箱内部，AI 认出你有什么食材，给你 **3 个今晚就能做的菜谱**（含步骤和耗时对比），缺的料自动汇总成购物清单。

系列 #05 · 纸墨复古 · 第一个真全栈项目（Next.js API Route + 多模态调用 + 信任设计）。

## 核心设计：两段式调用 + 中间修正

```
调用 1：照片 → 食材清单（视觉模型，低置信度标"？")
   ↓
【用户修正食材清单】← 识别永远做不到 100%，修正后的清单是用户"签名确认"过的
   ↓
调用 2：确认食材 + 偏好 → 3 个菜谱（文本模型）
        忌口 = 硬约束：prompt 强约束 + zod 校验 + 程序化复查（三重保险）
```

不做"一锤子"调用：用户见过中间结果，就不再觉得 AI 在黑箱里猜。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入密钥（或先设 LLM_MOCK=1 看演示）
npm run dev                  # http://localhost:3000
```

**没有密钥也能跑**：`.env.local` 里设 `LLM_MOCK=1`，两个接口返回固定演示数据，页面上会标注"演示数据模式"。
浏览器访问 `http://localhost:3000/?demo=1` 会多一个"演示食材"入口，不上传照片也能走通全流程。

## 环境变量（逐字段清单）

| 变量 | 说明 | 示例 |
|---|---|---|
| `LLM_BASE_URL` | OpenAI 兼容端点根路径（不带 `/chat/completions`） | `https://open.bigmodel.cn/api/paas/v4` |
| `LLM_API_KEY` | 服务端密钥，**绝不进前端 bundle** | 智谱开放平台控制台复制 |
| `LLM_VISION_MODEL` | 视觉模型 | `glm-4v-flash` |
| `LLM_TEXT_MODEL` | 文本模型（可与视觉不同） | `glm-4-flash` |
| `LLM_MOCK` | 设为 `1` 返回演示数据，仅本地调试 | `1` / 留空 |

- 本地：填进 `.env.local`（已 gitignore，不进仓库）
- 端点可随时切换：本地 Ollama（`http://localhost:11434/v1`，qwen2.5vl / llama3.2-vision）、OpenRouter 免费档、#08 freellmapi 自建网关

## 部署（Vercel 免费档）

1. 仓库推到 GitHub
2. vercel.com → Import，框架自动识别 Next.js
3. Project → Settings → Environment Variables：按上表逐个添加前 4 个字段（`LLM_MOCK` 不要配），Environment 勾 Production + Preview
4. Deploy → 访问分配的域名；以后改环境变量需 Redeploy 生效

## 测试

```bash
npm test        # vitest：zod schema、忌口程序化复查、missing 合并去重、压缩尺寸、页面状态机
npm run build   # 类型检查 + 生产构建
```

真实照片评测见 [`src/lib/eval/photos.md`](src/lib/eval/photos.md)——5 张标准照片 + 人工评分，是 prompt 的"验收测试"，改 prompt 必须跑一遍并记录。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                  # 主流程单页（reducer 状态机编排）
│   ├── layout.tsx
│   └── api/
│       ├── ingredients/route.ts  # 调用1：图 → 食材（zod 校验 + 坏 JSON 重试一次）
│       └── recipes/route.ts      # 调用2：食材+偏好 → 菜谱（复查双保险 + 重试）
├── components/
│   ├── UploadBox.tsx             # 冰箱门造型上传框（拍照/相册/拖拽/粘贴）
│   ├── IngredientEditor.tsx      # 食材 chips 编辑（删/补/点一下解除"？")
│   ├── PreferenceBar.tsx         # 忌口/口味/厨具（常驻可折叠）
│   ├── RecipeCard.tsx            # 菜谱卡（耗时横条对比 + 锅铲难度）
│   ├── CookMode.tsx              # 厨房模式（墨底纸字大字 + wakeLock 常亮）
│   ├── ShoppingList.tsx          # 三卡缺口合并去重 + 复制 Markdown
│   ├── HistoryPanel.tsx          # 最近做过 + 再做一次
│   └── Spatula.tsx               # 锅铲 SVG（难度图标 + 转圈动画）
└── lib/
    ├── llm.ts                    # OpenAI 兼容客户端（仅服务端引用）
    ├── vision.ts                 # 调用1 prompt + zod（版本 v1.0）
    ├── recipes.ts                # 调用2 prompt + zod + 忌口复查 + 购物清单合并
    ├── image.ts                  # 客户端压缩 1024px / q0.8（纯函数可测）
    ├── prefs.ts / history.ts     # localStorage
    ├── state.ts                  # 页面状态机 reducer
    └── eval/
        ├── photos.md             # 评测集照片清单 + 评测记录表 + prompt 版本历史
        └── schema.test.ts        # vitest 单测
```

## v1 明确不做

账号/云同步、过期食材识别（视觉判断不可靠，食品安全提醒做错比不做更糟）、视频教程。
