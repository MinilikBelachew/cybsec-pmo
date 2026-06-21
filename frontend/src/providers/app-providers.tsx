"use client";

import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { ThemeProvider } from "./theme-provider";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "@/config/msal.config";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      <Provider store={store}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </Provider>
    </MsalProvider>
  );
}

