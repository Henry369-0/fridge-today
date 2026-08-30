"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/lib/recipes";

interface Props {
  recipe: Recipe;
  onDone: () => void;
  onExit: () => void;
}

// 厨房模式：全屏墨底纸字（油手/光线差的可读性取舍），单步大字 + 巨型打勾 + 屏幕常亮
export default function CookMode({ recipe, onDone, onExit }: Props) {
  const [step, setStep] = useState(0);
  const total = recipe.steps.length;
  const last = step >= total - 1;

  // wakeLock 常亮（#02 经验复用）：页面隐藏后恢复时重新申请
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    type WakeLockNav = Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    let sentinel: Sentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const wl = (navigator as WakeLockNav).wakeLock;
        if (!wl || disposed) return;
        sentinel = await wl.request("screen");
      } catch {
        // 不支持就算了，不影响做菜
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release().catch(() => {});
    };
  }, []);

  function advance() {
    if (last) onDone();
    else setStep((s) => s + 1);
  }

  // 空格=做完这步，左右键翻步，Esc 退出（油手场景键位意义不大，桌面端顺手）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(total - 1, s + 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, last, onDone, onExit]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper">
      <header className="flex items-center justify-between border-b border-paper/20 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{recipe.name}</p>
          <p className="text-xs opacity-60">
            约 {recipe.timeMin} 分钟 · 难度 {recipe.difficulty}/3
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-paper/40 px-3 py-1 text-sm"
          onClick={onExit}
        >
          退出
        </button>
      </header>

      <div className="h-1 bg-paper/15">
        <div
          className="h-full bg-mustard transition-all duration-300"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm tracking-widest text-mustard">
          第 {step + 1} / {total} 步
        </p>
        <p className="mt-6 max-w-xl text-3xl leading-relaxed sm:text-4xl">{recipe.steps[step]}</p>
        {recipe.tips && <p className="mt-8 max-w-md text-sm opacity-60">小贴士：{recipe.tips}</p>}
      </main>

      <footer className="flex items-center justify-center gap-6 px-4 pb-10 pt-2">
        <button
          type="button"
          className="h-14 w-14 rounded-full border border-paper/40 text-sm disabled:opacity-30"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          上一步
        </button>
        <button
          type="button"
          className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-mustard text-ink shadow-[0_0_0_5px_rgba(217,164,65,0.25)] active:scale-95"
          onClick={advance}
          aria-label={last ? "完成烹饪" : "做完这步"}
        >
          {last ? (
            <span className="text-xl font-bold leading-tight">
              完成
              <br />
              开饭
            </span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor">
                <path d="M4 12.5 L10 18.5 L20 6" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="mt-0.5 text-xs font-bold">好了</span>
            </>
          )}
        </button>
        <div className="h-14 w-14" aria-hidden="true" />
      </footer>
    </div>
  );
}
