"use client";

import { useState } from "react";
import { mergeMissing, shoppingListMarkdown, type Recipe } from "@/lib/recipes";

// 三张卡的 missing 合并去重（同名合并数量），一键复制为 Markdown，可直接贴微信
export default function ShoppingList({ recipes }: { recipes: Recipe[] }) {
  const items = mergeMissing(recipes);
  const [copied, setCopied] = useState(false);
  if (items.length === 0) return null;

  async function copy() {
    const text = shoppingListMarkdown(items);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 非安全上下文（http）兜底
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="frame rounded-2xl bg-paper p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">购物清单（三张卡的缺口合并）</h2>
        <button type="button" className="btn-ink shrink-0 rounded-full px-4 py-1.5 text-sm" onClick={copy}>
          {copied ? "已复制 ✓" : "复制清单"}
        </button>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((i) => (
          <li key={i.name} className="flex items-baseline gap-2">
            <span className="font-bold">{i.name}</span>
            <span className="opacity-70">{i.qty}</span>
            <span className="ml-auto text-xs opacity-50">{i.from.join("、")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
