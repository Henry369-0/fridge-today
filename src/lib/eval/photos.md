# 评测集 · photos.md

Prompt 没法传统单测——固定 5 张标准照片 + 人工评分，是这个 LLM 应用唯一的"验收测试"。
**改 prompt = 必须跑一遍本表并记录，然后提交一次带评测记录的 commit。**

## 标准照片清单（本地存放，照片不进仓库）

| # | 照片 | 预期行为 |
|---|---|---|
| P1 | 塞满的冰箱 | sceneOk=true，识别 ≥80% 常见食材 |
| P2 | 几乎空冰箱（只有蛋和葱） | 正常输出"今晚适合做 X（只有蛋和葱）"式极简菜谱 |
| P3 | 只有饮料和调味料 | sceneOk=false，或输出"没得做，出门吃吧"式幽默建议 |
| P4 | 模糊/背光照片 | 不崩，低置信度标注多 |
| P5 | 一张猫的照片 | sceneOk=false，友好提示 |

## 评测记录表

| 日期 | prompt 版本 | 模型 | P1 | P2 | P3 | P4 | P5 | 备注 |
|---|---|---|---|---|---|---|---|---|
| 2026-08-30 | vision v1.0 / recipes v1.0 | LLM_MOCK=1（演示数据） | — | — | — | — | — | 仅链路验证：schema/复查/状态机单测通过，mock 走通全流程。**真实照片评测待配置密钥后回填（M1 验收）** |

## Prompt 版本历史

### vision v1.0（src/lib/vision.ts）
- 初版。指令全部放 user 消息（不假设端点支持 system role，GLM-4V 系列只保证 user/assistant 交替）。
- 要求 `sceneOk` + `ingredients[{name, confidence}]`；看不清/靠猜的 confidence ≤ 0.5（前端显示"？"，交给用户核对）。
- 已知取舍：写"宁可标低 confidence 也不要漏报"，识别偏激进，靠两段式里的人工修正兜底。

### recipes v1.0（src/lib/recipes.ts）
- 初版。四条铁律写进 system：只用现有食材 / 基础调味料视为常备（不进 used 也不进 missing，提前规避 v2 清单里说的"每周重新识别盐"）/ 忌口含同义词绝对不出现 / used ⊆ 现有清单。
- 代码侧 `reviewRecipes` 双保险：忌口子串扫描（含同义词表）→ 丢整道；used 越界（带"葱花=葱"形态后缀白名单）→ 丢整道；missing 写了已有的料 → 自动纠正为 used。不过关的重试一次。
- 已知取舍：忌"海鲜"时"鱼"也算（对水产过敏/不吃水产的人群宁严勿松）；"鱼香茄子"这类名字会被误杀——如果用户反馈多，再考虑加白名单。

## 改 prompt 的流程

1. 改 `src/lib/vision.ts` 或 `src/lib/recipes.ts` 里的版本号（如 v1.1），在"Prompt 版本历史"补一段改动原因
2. 用上面 5 张照片跑一遍（配好 `LLM_API_KEY` 后 `npm run dev`）
3. 在"评测记录表"加一行，写清结果
4. 提交 commit：prompt diff + 本文件一起
