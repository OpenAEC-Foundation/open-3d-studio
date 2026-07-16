import type { ParamValues } from "../../core/types";

export const MM = 0.001;

export function num(p: ParamValues, key: string, fallback = 0): number {
  const v = p[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
