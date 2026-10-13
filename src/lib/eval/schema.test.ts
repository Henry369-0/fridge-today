import { describe, expect, it } from "vitest";
import { computeTargetSize } from "../image";
import { visionResultSchema } from "../vision";
import {
  addQty,
  mergeMissing,
  recipesResultSchema,
  reviewRecipes,
  type PrefsInput,
  type Recipe,
} from "../recipes";
import { initialState, reducer } from "../state";

const existing = ["鸡蛋", "番茄", "葱", "五花肉", "青椒", "豆腐"];

const prefsBase: PrefsInput = { taboos: [], taste: null, tools: [], quickMode: false };

function mkRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    name: "番茄炒蛋",
    timeMin: 12,
    difficulty: 1,
    used: ["番茄", "鸡蛋"],
    missing: [],
    steps: ["打蛋", "下锅炒"],
    tips: null,
    ...over,
  };
}

describe("vision schema（调用 1 输出校验）", () => {
  it("接受合法输出", () => {
    const r = visionResultSchema.parse({
      sceneOk: true,
      ingredients: [{ name: "鸡蛋", confidence: 0.9 }],
    });
    expect(r.ingredients).toHaveLength(1);
  });
  it("缺 ingredients 时默认空数组", () => {
    const r = visionResultSchema.parse({ sceneOk: false });
    expect(r.ingredients).toEqual([]);
  });
  it("拒绝越界 confidence 和非布尔 sceneOk", () => {
    expect(
      visionResultSchema.safeParse({ sceneOk: true, ingredients: [{ name: "蛋", confidence: 1.5 }] })
        .success,
    ).toBe(false);
    expect(visionResultSchema.safeParse({ sceneOk: "yes" }).success).toBe(false);
  });
});

describe("recipes schema（调用 2 输出校验）", () => {
  it("接受三个菜谱", () => {
    const data = {
      recipes: [mkRecipe(), mkRecipe({ name: "B" }), mkRecipe({ name: "C" })],
    };
    expect(recipesResultSchema.safeParse(data).success).toBe(true);
  });
  it("拒绝难度 4 / 空 steps / 负耗时", () => {
    expect(recipesResultSchema.safeParse({ recipes: [mkRecipe({ difficulty: 4 })] }).success).toBe(false);
    expect(recipesResultSchema.safeParse({ recipes: [mkRecipe({ steps: [] })] }).success).toBe(false);
    expect(recipesResultSchema.safeParse({ recipes: [mkRecipe({ timeMin: -5 })] }).success).toBe(false);
  });
});

describe("忌口复查 + 防编造复查（安全红线的代码兜底）", () => {
  it("步骤里出现忌口 → 整道丢弃", () => {
    const review = reviewRecipes(
      [mkRecipe({ steps: ["放香菜提味", "出锅"] })],
      existing,
      { ...prefsBase, taboos: ["香菜"] },
    );
    expect(review.recipes).toHaveLength(0);
    expect(review.issues[0]).toContain("香菜");
  });
  it("忌口同义词也算违反（虾 → 海鲜）", () => {
    const review = reviewRecipes(
      [mkRecipe({ name: "白灼虾", steps: ["煮虾"] })],
      existing,
      { ...prefsBase, taboos: ["海鲜"] },
    );
    expect(review.recipes).toHaveLength(0);
  });
  it("used 了清单外的东西 → 丢弃（防编造）", () => {
    const review = reviewRecipes([mkRecipe({ used: ["番茄", "排骨"] })], existing, prefsBase);
    expect(review.recipes).toHaveLength(0);
  });
  it("快手模式过滤超时菜", () => {
    const review = reviewRecipes([mkRecipe({ timeMin: 25 })], existing, {
      ...prefsBase,
      quickMode: true,
    });
    expect(review.recipes).toHaveLength(0);
  });
  it("已有的料被写进 missing → 自动纠正成 used", () => {
    const review = reviewRecipes(
      [mkRecipe({ missing: [{ name: "鸡蛋", qty: "2 个" }] })],
      existing,
      prefsBase,
    );
    expect(review.recipes[0]?.missing).toHaveLength(0);
    expect(review.recipes[0]?.used).toContain("鸡蛋");
  });
  it("常备调味料不进 used 也不进 missing", () => {
    const review = reviewRecipes(
      [mkRecipe({ used: ["番茄", "鸡蛋", "盐"], missing: [{ name: "生抽", qty: "1 勺" }] })],
      existing,
      prefsBase,
    );
    expect(review.recipes[0]?.used).toEqual(["番茄", "鸡蛋"]);
    expect(review.recipes[0]?.missing).toHaveLength(0);
  });
  it("葱花 = 葱 的形态后缀放行；番茄酱 ≠ 番茄", () => {
    const ok = reviewRecipes([mkRecipe({ used: ["番茄", "葱花"] })], existing, prefsBase);
    expect(ok.recipes).toHaveLength(1);
    const bad = reviewRecipes([mkRecipe({ used: ["番茄", "番茄酱"] })], existing, prefsBase);
    expect(bad.recipes).toHaveLength(0);
  });
});

describe("购物清单合并去重", () => {
  it("同名合并数量、记录来源", () => {
    const items = mergeMissing([
      mkRecipe({ name: "A", missing: [{ name: "香油", qty: "5 克" }] }),
      mkRecipe({ name: "B", missing: [{ name: "香油", qty: "10 克" }, { name: "蚝油", qty: "1 勺" }] }),
    ]);
    expect(items).toHaveLength(2);
    const oil = items.find((i) => i.name === "香油");
    expect(oil?.qty).toBe("15克");
    expect(oil?.from).toEqual(["A", "B"]);
  });
  it("单位不同就并列", () => {
    const items = mergeMissing([
      mkRecipe({ name: "A", missing: [{ name: "鸡蛋", qty: "2 个" }] }),
      mkRecipe({ name: "B", missing: [{ name: "鸡蛋", qty: "一盒" }] }),
    ]);
    expect(items[0]?.qty).toBe("2 个 + 一盒");
  });
  it("addQty 直接相加", () => {
    expect(addQty("200克", "100克")).toBe("300克");
    expect(addQty("1.5 勺", "1 勺")).toBe("2.5勺");
    expect(addQty("半个", "半个")).toBe("半个 ×2");
  });
});

describe("图片压缩尺寸（纯函数部分）", () => {
  it("大图等比压到 1024", () => {
    expect(computeTargetSize(4032, 3024)).toEqual({ width: 1024, height: 768 });
    expect(computeTargetSize(3024, 4032)).toEqual({ width: 768, height: 1024 });
  });
  it("小图不放大", () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("正方形", () => {
    expect(computeTargetSize(3000, 3000)).toEqual({ width: 1024, height: 1024 });
  });
});

describe("页面状态机", () => {
  const ingredients = [{ name: "鸡蛋", uncertain: false }];

  it("完整主流程 upload → cooking → results", () => {
    let s = reducer(initialState, { type: "SUBMIT_PHOTO", photo: "data:image/jpeg;base64,xx" });
    expect(s.stage).toBe("recognizing");
    s = reducer(s, { type: "RECOGNIZED", ingredients, sceneOk: true, mock: true });
    expect(s.stage).toBe("editing");
    s = reducer(s, { type: "START_GENERATING" });
    expect(s.stage).toBe("generating");
    s = reducer(s, { type: "RECIPES_READY", recipes: [mkRecipe()], mock: true });
    expect(s.stage).toBe("results");
    s = reducer(s, { type: "SELECT_RECIPE", recipe: mkRecipe() });
    expect(s.stage).toBe("cooking");
    s = reducer(s, { type: "FINISH_COOKING" });
    expect(s.stage).toBe("results");
    expect(s.notice).toBeTruthy();
  });
  it("识别失败回到上传页并带错误", () => {
    let s = reducer(initialState, { type: "SUBMIT_PHOTO", photo: "data:x" });
    s = reducer(s, { type: "RECOGNIZE_FAILED", error: "网络" });
    expect(s.stage).toBe("upload");
    expect(s.error).toBe("网络");
  });
  it("配菜失败回到编辑页（食材编辑不丢）", () => {
    let s = reducer(initialState, { type: "RECOGNIZED", ingredients, sceneOk: true, mock: false });
    s = reducer(s, { type: "START_GENERATING" });
    s = reducer(s, { type: "GENERATE_FAILED", error: "限流" });
    expect(s.stage).toBe("editing");
    expect(s.ingredients).toEqual(ingredients);
  });
  it("sceneOk=false 进编辑页（显示友好提示分支）", () => {
    const s = reducer(initialState, {
      type: "RECOGNIZED",
      ingredients: [],
      sceneOk: false,
      mock: false,
    });
    expect(s.stage).toBe("editing");
    expect(s.sceneOk).toBe(false);
  });
  it("从历史直接进厨房，退出回首页", () => {
    let s = reducer(initialState, { type: "SELECT_RECIPE", recipe: mkRecipe() });
    expect(s.stage).toBe("cooking");
    s = reducer(s, { type: "EXIT_COOKING" });
    expect(s.stage).toBe("upload");
  });
  it("从历史复做完成后回首页，不进入空结果页", () => {
    let s = reducer(initialState, { type: "SELECT_RECIPE", recipe: mkRecipe() });
    s = reducer(s, { type: "FINISH_COOKING" });
    expect(s.stage).toBe("upload");
    expect(s.selected).toBeNull();
    expect(s.notice).toBe("已记入「最近做过」");
  });
  it("从当前结果退出厨房保留菜谱列表", () => {
    const recipes = [mkRecipe()];
    let s = reducer(initialState, { type: "RECIPES_READY", recipes, mock: true });
    s = reducer(s, { type: "SELECT_RECIPE", recipe: recipes[0] });
    s = reducer(s, { type: "EXIT_COOKING" });
    expect(s.stage).toBe("results");
    expect(s.recipes).toEqual(recipes);
    expect(s.selected).toBeNull();
  });
});
