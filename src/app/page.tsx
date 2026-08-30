"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import UploadBox from "@/components/UploadBox";
import IngredientEditor from "@/components/IngredientEditor";
import PreferenceBar from "@/components/PreferenceBar";
import RecipeCard from "@/components/RecipeCard";
import CookMode from "@/components/CookMode";
import ShoppingList from "@/components/ShoppingList";
import HistoryPanel from "@/components/HistoryPanel";
import { SpatulaSpinner } from "@/components/Spatula";
import { compressImageFile } from "@/lib/image";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { addHistory } from "@/lib/history";
import { initialState, reducer, type Ingredient } from "@/lib/state";
import type { Recipe } from "@/lib/recipes";

function QuickSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex shrink-0 items-center gap-2 text-sm"
    >
      <span
        className={`relative inline-block h-6 w-11 shrink-0 rounded-full border-2 border-ink transition-colors ${
          checked ? "bg-pine" : "bg-paper"
        }`}
      >
        <span
          className={`absolute top-[1px] h-4 w-4 rounded-full border-2 border-ink transition-all ${
            checked ? "left-[20px] bg-paper" : "left-[1px] bg-ink"
          }`}
        />
      </span>
      快手模式（≤20 分钟）
    </button>
  );
}

function PhotoPending({ photo, label }: { photo: string; label: string }) {
  return (
    <div className="frame relative mt-2 overflow-hidden rounded-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="待识别的冰箱照片" className="max-h-96 w-full object-cover opacity-90" />
      <div className="absolute inset-0 flex items-end justify-center bg-ink/20 pb-6">
        <div className="rounded-full bg-paper px-6 py-3">
          <SpatulaSpinner label={label} />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [historyKey, setHistoryKey] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const prefsLoaded = useRef(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    prefsLoaded.current = true;
    setDemoMode(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);
  useEffect(() => {
    if (prefsLoaded.current) savePrefs(prefs);
  }, [prefs]);

  // 成功提示 2.6 秒自动消失
  useEffect(() => {
    if (!state.notice) return;
    const t = setTimeout(() => dispatch({ type: "DISMISS_NOTICE" }), 2600);
    return () => clearTimeout(t);
  }, [state.notice]);

  // 上传页支持直接粘贴截图
  useEffect(() => {
    if (state.stage !== "upload") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  async function handleFile(file: File) {
    let photo: string;
    try {
      photo = await compressImageFile(file);
    } catch {
      dispatch({ type: "RECOGNIZE_FAILED", error: "这张图读不出来，换一张试试。" });
      return;
    }
    dispatch({ type: "SUBMIT_PHOTO", photo });
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        dispatch({ type: "RECOGNIZE_FAILED", error: data?.error ?? "识别失败了，请再试一次。" });
        return;
      }
      if (data.sceneOk === false) {
        dispatch({ type: "RECOGNIZED", ingredients: [], sceneOk: false, mock: !!data.mock });
        return;
      }
      const ingredients: Ingredient[] = (Array.isArray(data.ingredients) ? data.ingredients : [])
        .map((i: { name?: unknown; confidence?: unknown }) => ({
          name: typeof i?.name === "string" ? i.name.trim().slice(0, 12) : "",
          uncertain: typeof i?.confidence === "number" ? i.confidence < 0.6 : true,
        }))
        .filter((i: Ingredient) => i.name);
      dispatch({ type: "RECOGNIZED", ingredients, sceneOk: true, mock: !!data.mock });
    } catch {
      dispatch({ type: "RECOGNIZE_FAILED", error: "网络不太顺，检查连接后再拍一张。" });
    }
  }

  async function handleGenerate() {
    if (state.ingredients.length === 0) return;
    dispatch({ type: "START_GENERATING" });
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: state.ingredients.map((i) => i.name),
          prefs,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        dispatch({ type: "GENERATE_FAILED", error: data?.error ?? "配菜失败了，请再试一次。" });
        return;
      }
      const recipes: Recipe[] = Array.isArray(data.recipes) ? data.recipes : [];
      if (recipes.length === 0) {
        dispatch({
          type: "GENERATE_FAILED",
          error: "一个能做的菜都没配出来，改改食材或偏好再试一次。",
        });
        return;
      }
      dispatch({ type: "RECIPES_READY", recipes, mock: !!data.mock });
    } catch {
      dispatch({ type: "GENERATE_FAILED", error: "网络不太顺，再试一次。" });
    }
  }

  function handleFinish() {
    if (state.selected) addHistory(state.selected);
    setHistoryKey((k) => k + 1);
    dispatch({ type: "FINISH_COOKING" });
  }

  const minTime = state.recipes.length > 0 ? Math.min(...state.recipes.map((x) => x.timeMin)) : 0;
  const maxTime = state.recipes.length > 0 ? Math.max(...state.recipes.map((x) => x.timeMin)) : 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-10">
      <header className="flex items-baseline justify-between py-4">
        <p className="text-sm font-bold tracking-widest">冰箱食堂</p>
        <p className="text-xs opacity-50">fridge.today · 手工测量</p>
      </header>

      <main className="flex-1">
        {state.stage === "upload" && (
          <>
            <h1 className="mt-2 text-center text-4xl font-bold tracking-wide">今晚吃什么？</h1>
            <p className="mt-3 text-center text-sm opacity-70">
              拍一张冰箱内部，30 秒给你三个今晚就能做的菜。
            </p>
            <div className="mt-6">
              <UploadBox onFile={handleFile} />
            </div>
            {demoMode && (
              <button
                type="button"
                className="mx-auto mt-4 block text-xs text-brick underline"
                onClick={() =>
                  dispatch({
                    type: "RECOGNIZED",
                    ingredients: [
                      { name: "鸡蛋", uncertain: false },
                      { name: "番茄", uncertain: false },
                      { name: "葱", uncertain: false },
                      { name: "五花肉", uncertain: false },
                      { name: "豆腐", uncertain: false },
                      { name: "青椒", uncertain: true },
                    ],
                    sceneOk: true,
                    mock: true,
                  })
                }
              >
                （?demo=1）不走识别，直接看演示食材 →
              </button>
            )}
            <HistoryPanel
              onRecook={(r) => dispatch({ type: "SELECT_RECIPE", recipe: r })}
              refreshKey={historyKey}
            />
          </>
        )}

        {state.stage === "recognizing" && state.photo && (
          <PhotoPending photo={state.photo} label="AI 正在翻你的冰箱…" />
        )}

        {state.stage === "editing" && (
          <div className="mt-2 space-y-4">
            {state.sceneOk === false ? (
              <section className="frame rounded-2xl bg-paper p-8 text-center">
                <p className="text-4xl">🥺</p>
                <p className="mt-3 text-lg font-bold">这好像不是冰箱里的样子</p>
                <p className="mt-2 text-sm opacity-70">
                  拍一下冰箱内部；把食材摆在桌上拍也可以，但一只猫是真做不了菜的。
                </p>
                <button
                  type="button"
                  className="btn-brick mt-5 rounded-full px-6 py-2 font-bold"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  重拍一张
                </button>
              </section>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {state.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.photo}
                      alt="刚拍的冰箱"
                      className="h-16 w-16 rounded-lg border-2 border-ink object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-bold">食材认好了，你来定稿</p>
                    <button
                      type="button"
                      className="text-xs text-brick underline"
                      onClick={() => dispatch({ type: "RESET" })}
                    >
                      重拍一张
                    </button>
                  </div>
                </div>
                <IngredientEditor
                  ingredients={state.ingredients}
                  onChange={(items) => dispatch({ type: "EDIT_INGREDIENTS", items })}
                />
                <PreferenceBar prefs={prefs} onChange={setPrefs} />
                <div className="flex items-center justify-between gap-3">
                  <QuickSwitch
                    checked={prefs.quickMode}
                    onChange={(v) => setPrefs((p) => ({ ...p, quickMode: v }))}
                  />
                  <button
                    type="button"
                    className="btn-brick flex-1 rounded-full py-3 text-lg font-bold disabled:opacity-40"
                    disabled={state.ingredients.length === 0}
                    onClick={handleGenerate}
                  >
                    开始配菜
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {state.stage === "generating" && (
          <div className="frame mt-2 flex flex-col items-center rounded-2xl bg-paper px-6 py-12">
            <SpatulaSpinner label="正在配菜…" />
            <div className="mt-6 flex max-w-full flex-wrap justify-center gap-1.5">
              {state.ingredients.map((i) => (
                <span key={i.name} className="chip opacity-60">
                  {i.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {state.stage === "results" && (
          <div className="mt-2 space-y-4">
            <div className="flex items-baseline justify-between">
              <h1 className="text-2xl font-bold">今晚这三道都行</h1>
              <button
                type="button"
                className="text-xs text-brick underline"
                onClick={() => dispatch({ type: "BACK_TO_EDITING" })}
              >
                改食材 / 偏好，重新配
              </button>
            </div>
            <div className="space-y-4">
              {state.recipes.map((r) => (
                <RecipeCard
                  key={r.name}
                  recipe={r}
                  maxTime={maxTime}
                  fastest={r.timeMin === minTime}
                  onSelect={(recipe) => dispatch({ type: "SELECT_RECIPE", recipe })}
                />
              ))}
            </div>
            <ShoppingList recipes={state.recipes} />
            <button
              type="button"
              className="block w-full text-center text-xs opacity-50 underline"
              onClick={() => dispatch({ type: "RESET" })}
            >
              换张冰箱照片，重新来
            </button>
          </div>
        )}
      </main>

      <footer className="pt-10 text-center text-xs opacity-50">
        <p>fridge.today · 手工测量</p>
        <p className="mt-1">食材新鲜度请自行判断，生熟分开</p>
        {state.mock && <p className="mt-2 text-brick">当前为演示数据模式（未配置真实模型）</p>}
      </footer>

      {state.stage === "cooking" && state.selected && (
        <CookMode
          recipe={state.selected}
          onDone={handleFinish}
          onExit={() => dispatch({ type: "EXIT_COOKING" })}
        />
      )}

      {state.error && (
        <div
          className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md rounded-xl border-2 border-ink bg-brick px-4 py-3 text-sm text-paper shadow-[3px_3px_0_0_#2b2b26]"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1">{state.error}</p>
            <button type="button" onClick={() => dispatch({ type: "DISMISS_ERROR" })} aria-label="关闭">
              ×
            </button>
          </div>
        </div>
      )}

      {state.notice && (
        <div className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md rounded-xl border-2 border-ink bg-pine px-4 py-3 text-center text-sm text-paper shadow-[3px_3px_0_0_#2b2b26]">
          {state.notice}
        </div>
      )}
    </div>
  );
}
