import { Inter, Roboto_Mono } from "next/font/google";

/**
 * Enterprise Font Configuration
 * Centralized font definitions to easily swap out fonts across the entire application.
 * Utilizes next/font/google for automatic self-hosting and zero layout shift.
 */

export const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap", // Ensures text remains visible during webfont load
});

export const fontMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});
