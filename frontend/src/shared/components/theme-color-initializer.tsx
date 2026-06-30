"use client";

import { useEffect } from "react";

const STORAGE_KEY = "theme-color";
const DEFAULT_COLOR = "indigo";

/** Applies saved accent color on first paint (before any modal opens). */
export function ThemeColorInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    document.documentElement.setAttribute(
      "data-theme-color",
      saved ?? DEFAULT_COLOR,
    );
  }, []);

  return null;
}
