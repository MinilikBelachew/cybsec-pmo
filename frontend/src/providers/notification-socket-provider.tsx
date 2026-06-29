"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/domains/auth";
import { env } from "@/config/env.config";
import { api } from "@/core/api/api";

function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
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

    const token = getAccessTokenFromCookie();

    const socket = io(`${env.wsUrl}/notifications`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: token ? { token } : {},
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

    return () => {
      socket.off("connect", invalidateRealtimeQueries);
      socket.off("notification.created", invalidateRealtimeQueries);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  return children;
}
