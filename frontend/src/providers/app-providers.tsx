"use client";

import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "react-hot-toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster position="top-right" reverseOrder={false} />
      </ThemeProvider>
    </Provider>
  );
}
