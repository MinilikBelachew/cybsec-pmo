"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/domains/auth";
import { env } from "@/config/env.config";
import { api } from "@/core/api/api";

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/ws-token", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

export function NotificationSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    let cancelled = false;

    const connect = async () => {
      const token = await fetchWsToken();
      if (cancelled || !token) return;

      const socket = io(`${env.wsUrl}/notifications`, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: true,
        auth: { token },
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      const invalidateRealtimeQueries = () => {
        api.util.invalidateTags(["Notifications", "TaskProgress"]);
      };

      socket.on("connect", invalidateRealtimeQueries);
      socket.on("notification.created", invalidateRealtimeQueries);

      socketRef.current = socket;
    };

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  return children;
}
