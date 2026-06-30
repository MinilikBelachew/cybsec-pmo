"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeColor =
  | "purple"
  | "blue"
  | "pink"
  | "violet"
  | "indigo"
  | "orange"
  | "teal"
  | "bronze"
  | "mint";

const STORAGE_KEY = "theme-color";
const DEFAULT_COLOR: ThemeColor = "indigo";

function applyThemeColor(color: ThemeColor) {
  document.documentElement.setAttribute("data-theme-color", color);
}

export function useThemeColor() {
  const [themeColor, setThemeColorState] = useState<ThemeColor>(DEFAULT_COLOR);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeColor | null;
    const color = saved ?? DEFAULT_COLOR;
    setThemeColorState(color);
    applyThemeColor(color);
  }, []);

  const setThemeColor = useCallback((color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem(STORAGE_KEY, color);
    applyThemeColor(color);
  }, []);

  return { themeColor, setThemeColor };
}
