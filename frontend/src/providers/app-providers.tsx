"use client";

import { type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { ThemeProvider } from "./theme-provider";
import { ThemeColorInitializer } from "@/shared/components/theme-color-initializer";
import { Toaster } from "react-hot-toast";
import { NotificationSocketProvider } from "./notification-socket-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ThemeColorInitializer />
        <NotificationSocketProvider>
          {children}
        </NotificationSocketProvider>
        <Toaster position="top-right" reverseOrder={false} />
      </ThemeProvider>
    </Provider>
  );
}
