"use client";

import { useEffect, useState } from "react";
import { loadHistory, removeHistory, type HistoryItem } from "@/lib/history";
import type { Recipe } from "@/lib/recipes";

interface Props {
  onRecook: (recipe: Recipe) => void;
  refreshKey: number; // 做完一道菜后由父页面 +1 触发刷新
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function toRecipe(h: HistoryItem): Recipe {
  return {
    name: h.name,
    timeMin: h.timeMin,
    difficulty: h.difficulty,
    used: h.used ?? [],
    missing: h.missing ?? [],
    steps: h.steps && h.steps.length > 0 ? h.steps : ["（没有步骤记录，凭记忆做吧）"],
    tips: h.tips ?? undefined,
  };
}

// 历史页：最近做过的菜，可"再做一次"（直接进厨房模式）
export default function HistoryPanel({ onRecook, refreshKey }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    setItems(loadHistory());
  }, [refreshKey]);

  if (items.length === 0) return null;

  return (
    <section className="frame mt-4 rounded-2xl bg-paper p-4">
      <h2 className="text-lg font-bold">最近做过</h2>
      <ul className="mt-1 divide-y divide-dashed divide-ink/20">
        {items.map((h) => (
          <li key={`${h.name}-${h.cookedAt}`} className="flex items-center gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-bold">{h.name}</p>
              <p className="text-xs opacity-60">
                {formatDate(h.cookedAt)} · 约 {h.timeMin} 分钟
              </p>
            </div>
            <div className="ml-auto flex shrink-0 gap-2">
              <button type="button" className="btn-ink rounded-full px-3 py-1 text-xs" onClick={() => onRecook(toRecipe(h))}>
                再做一次
              </button>
              <button
                type="button"
                className="rounded-full border border-ink/30 px-2.5 py-1 text-xs opacity-60"
                onClick={() => setItems(removeHistory(h.name))}
                aria-label={`删除记录 ${h.name}`}
              >
                删
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
