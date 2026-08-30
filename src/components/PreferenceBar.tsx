"use client";

import { useState, type ReactNode } from "react";
import { PRESET_TABOOS, TASTE_OPTIONS, TOOL_OPTIONS } from "@/lib/recipes";
import type { Prefs } from "@/lib/prefs";

interface Props {
  prefs: Prefs;
  // 用函数式更新，避免连续快速点选时用旧闭包整体覆盖（丢掉刚选的忌口）
  onChange: (update: (p: Prefs) => Prefs) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 w-10 shrink-0 text-sm font-bold opacity-70">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// 常驻可折叠的偏好栏：忌口（硬约束）/ 口味 / 厨具；快手开关放在"开始配菜"旁边
export default function PreferenceBar({ prefs, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const [custom, setCustom] = useState("");

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  function addCustom() {
    const v = custom.trim().slice(0, 12);
    if (!v || prefs.taboos.includes(v)) return;
    onChange((p) => ({ ...p, taboos: [...p.taboos, v] }));
    setCustom("");
  }

  const summary = [
    prefs.taboos.length > 0 ? `忌口 ${prefs.taboos.length}` : null,
    prefs.taste,
    prefs.tools.length > 0 ? `厨具 ${prefs.tools.length}` : null,
    prefs.quickMode ? "快手" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="frame rounded-2xl bg-paper">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-lg font-bold">
          偏好
          {summary && <span className="ml-2 text-sm font-normal opacity-60">{summary}</span>}
        </span>
        <span className="text-sm opacity-60">{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t-2 border-dashed border-ink/30 px-4 py-3">
          <Row label="忌口">
            {[...PRESET_TABOOS].map((t) => (
              <button
                type="button"
                key={t}
                className={`chip ${prefs.taboos.includes(t) ? "chip-on" : ""}`}
                onClick={() => onChange((p) => ({ ...p, taboos: toggleArr(p.taboos, t) }))}
              >
                {t}
              </button>
            ))}
            {prefs.taboos
              .filter((t) => !(PRESET_TABOOS as readonly string[]).includes(t))
              .map((t) => (
                <button
                  type="button"
                  key={t}
                  className="chip chip-on"
                  onClick={() => onChange((p) => ({ ...p, taboos: p.taboos.filter((x) => x !== t) }))}
                  title="点击移除自定义忌口"
                >
                  {t} ×
                </button>
              ))}
          </Row>
          <Row label=" ">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="其他忌口，回车添加"
              maxLength={12}
              className="min-w-0 flex-1 rounded-full border-2 border-ink bg-transparent px-4 py-1 text-sm outline-none placeholder:opacity-40 focus:shadow-[2px_2px_0_0_#2b2b26]"
            />
          </Row>

          <Row label="口味">
            {TASTE_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                className={`chip ${prefs.taste === t ? "chip-on" : ""}`}
                onClick={() => onChange((p) => ({ ...p, taste: p.taste === t ? null : t }))}
              >
                {t}
              </button>
            ))}
            <span className="self-center text-xs opacity-50">可不选</span>
          </Row>

          <Row label="厨具">
            {TOOL_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                className={`chip ${prefs.tools.includes(t) ? "chip-on" : ""}`}
                onClick={() => onChange((p) => ({ ...p, tools: toggleArr(p.tools, t) }))}
              >
                {t}
              </button>
            ))}
            <span className="self-center text-xs opacity-50">默认当燃气灶齐全</span>
          </Row>
        </div>
      )}
    </section>
  );
}
