"use client";

import { Spatula } from "./Spatula";
import type { Recipe } from "@/lib/recipes";

interface Props {
  recipe: Recipe;
  maxTime: number;
  fastest: boolean;
  onSelect: (r: Recipe) => void;
}

// 菜谱卡：耗时横条对比（三卡并排一眼看出哪个最快）、难度 = 小锅铲 1-3 把
export default function RecipeCard({ recipe, maxTime, fastest, onSelect }: Props) {
  const pct = Math.max(12, Math.round((recipe.timeMin / maxTime) * 100));
  return (
    <article className="frame flex flex-col rounded-2xl bg-paper p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xl font-bold leading-snug">{recipe.name}</h3>
        <span
          className="flex shrink-0 items-center gap-0.5 pt-1.5 text-ink"
          title={`难度 ${recipe.difficulty}/3`}
          aria-label={`难度 ${recipe.difficulty}/3`}
        >
          {Array.from({ length: recipe.difficulty }).map((_, i) => (
            <Spatula key={i} size={14} />
          ))}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs opacity-70">
          <span>耗时</span>
          <span>
            {fastest && <b className="text-pine">最快 </b>}约 {recipe.timeMin} 分钟
          </span>
        </div>
        <div className="mt-1 h-3 rounded-full border-2 border-ink">
          <div
            className={`h-full rounded-full ${fastest ? "bg-pine" : "bg-mustard"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 text-sm">
        <p className="font-bold">用到的：</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {recipe.used.length > 0 ? (
            recipe.used.map((u) => (
              <span key={u} className="chip-mini chip-mini-on">
                {u}
              </span>
            ))
          ) : (
            <span className="opacity-60">—</span>
          )}
        </div>
      </div>

      <div className="mt-2 text-sm">
        <p className="font-bold">缺的：</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {recipe.missing.length > 0 ? (
            recipe.missing.map((m) => (
              <span key={m.name} className="chip-mini chip-mini-missing">
                {m.name} · {m.qty}
              </span>
            ))
          ) : (
            <span className="text-pine">不缺，直接做</span>
          )}
        </div>
      </div>

      {recipe.tips && <p className="mt-2 text-xs opacity-60">小贴士：{recipe.tips}</p>}

      <button
        type="button"
        className="btn-brick mt-4 rounded-full py-2.5 text-center font-bold"
        onClick={() => onSelect(recipe)}
      >
        就做这个，进厨房 →
      </button>
    </article>
  );
}
