import type { Recipe } from "./recipes";

// 页面状态机：upload → recognizing → editing → generating → results → cooking
export type Stage = "upload" | "recognizing" | "editing" | "generating" | "results" | "cooking";

export interface Ingredient {
  name: string;
  uncertain: boolean; // 置信度低 → 显示"？"，等用户确认
}

export interface State {
  stage: Stage;
  photo: string | null; // 压缩后的 dataURL
  sceneOk: boolean | null; // false = 这不是冰箱/食材照片
  ingredients: Ingredient[];
  recipes: Recipe[];
  selected: Recipe | null;
  error: string | null;
  notice: string | null;
  mock: boolean; // 命中演示数据模式时页面亮明身份
}

export const initialState: State = {
  stage: "upload",
  photo: null,
  sceneOk: null,
  ingredients: [],
  recipes: [],
  selected: null,
  error: null,
  notice: null,
  mock: false,
};

export type Action =
  | { type: "SUBMIT_PHOTO"; photo: string }
  | { type: "RECOGNIZED"; ingredients: Ingredient[]; sceneOk: boolean; mock: boolean }
  | { type: "RECOGNIZE_FAILED"; error: string }
  | { type: "EDIT_INGREDIENTS"; items: Ingredient[] }
  | { type: "START_GENERATING" }
  | { type: "RECIPES_READY"; recipes: Recipe[]; mock: boolean }
  | { type: "GENERATE_FAILED"; error: string }
  | { type: "BACK_TO_EDITING" }
  | { type: "SELECT_RECIPE"; recipe: Recipe }
  | { type: "FINISH_COOKING" }
  | { type: "EXIT_COOKING" }
  | { type: "RESET" }
  | { type: "DISMISS_ERROR" }
  | { type: "DISMISS_NOTICE" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SUBMIT_PHOTO":
      return { ...initialState, stage: "recognizing", photo: action.photo };
    case "RECOGNIZED":
      return {
        ...state,
        stage: "editing",
        ingredients: action.ingredients,
        sceneOk: action.sceneOk,
        mock: action.mock,
        error: null,
      };
    case "RECOGNIZE_FAILED":
      return { ...state, stage: "upload", error: action.error };
    case "EDIT_INGREDIENTS":
      return { ...state, ingredients: action.items };
    case "START_GENERATING":
      return { ...state, stage: "generating", error: null };
    case "RECIPES_READY":
      return { ...state, stage: "results", recipes: action.recipes, mock: action.mock, error: null };
    case "GENERATE_FAILED":
      return { ...state, stage: "editing", error: action.error };
    case "BACK_TO_EDITING":
      return { ...state, stage: "editing", error: null };
    case "SELECT_RECIPE":
      return { ...state, stage: "cooking", selected: action.recipe };
    case "FINISH_COOKING":
      return { ...state, stage: "results", selected: null, notice: "已记入「最近做过」" };
    case "EXIT_COOKING":
      return { ...state, stage: state.recipes.length > 0 ? "results" : "upload", selected: null };
    case "RESET":
      return { ...initialState };
    case "DISMISS_ERROR":
      return { ...state, error: null };
    case "DISMISS_NOTICE":
      return { ...state, notice: null };
  }
}
