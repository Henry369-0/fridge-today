"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/state";

interface Props {
  ingredients: Ingredient[];
  onChange: (items: Ingredient[]) => void;
}

// 食材 chips 编辑：删误识别、补漏、点一下解除"？"标注。
// 这是产品最核心的信任设计——识别结果必须经过用户"签名确认"。
export default function IngredientEditor({ ingredients, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim().slice(0, 12);
    if (!name) return;
    if (ingredients.some((i) => i.name === name)) {
      setDraft("");
      return;
    }
    onChange([...ingredients, { name, uncertain: false }]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(ingredients.filter((_, i) => i !== idx));
  }

  function toggleUncertain(idx: number) {
    onChange(ingredients.map((i, j) => (j === idx ? { ...i, uncertain: !i.uncertain } : i)));
  }

  return (
    <section className="frame rounded-2xl bg-paper p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">冰箱里有什么？</h2>
        <span className="text-xs opacity-60">AI 认的，你来定稿</span>
      </div>

      {ingredients.length === 0 && (
        <p className="mt-3 text-sm text-brick">一个食材都没认出来。别急，手动补几个吧。</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {ingredients.map((ing, idx) => (
          <span
            key={`${ing.name}-${idx}`}
            className={`chip ${ing.uncertain ? "chip-uncertain" : ""}`}
            onClick={() => toggleUncertain(idx)}
            title={ing.uncertain ? "AI 不太确定，点一下确认" : "点一下重新标为不确定"}
          >
            {ing.uncertain && <b className="mr-0.5">?</b>}
            {ing.name}
            <button
              type="button"
              className="ml-1 font-bold opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                remove(idx);
              }}
              aria-label={`删除 ${ing.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="漏了什么？手动补上（回车添加）"
          maxLength={12}
          className="min-w-0 flex-1 rounded-full border-2 border-ink bg-transparent px-4 py-1.5 text-sm outline-none placeholder:opacity-40 focus:shadow-[2px_2px_0_0_#2b2b26]"
        />
        <button type="button" className="btn-ink rounded-full px-4 py-1.5 text-sm" onClick={add}>
          补上
        </button>
      </div>

      <p className="mt-2 text-xs opacity-60">带 ? 的表示 AI 把握不大，点一下它就算你确认过了。</p>
    </section>
  );
}
