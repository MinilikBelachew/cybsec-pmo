"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  useGetSessionPolicyQuery,
  useLogoutMutation,
  useRefreshSessionMutation,
  useSessionHeartbeatMutation,
} from "../api/auth.api";
import { SessionTimeoutModal } from "../components/session-timeout-modal";
import { endClientSession } from "../utils/clear-session";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
  "focus",
] as const;

/** Sync UI activity to backend at most once per minute. */
const HEARTBEAT_INTERVAL_MS = 60_000;

export function SessionTimeoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const { data: policy, isSuccess: policyLoaded } = useGetSessionPolicyQuery();
  const [refreshSession] = useRefreshSessionMutation();
  const [sessionHeartbeat] = useSessionHeartbeatMutation();
  const [logout] = useLogoutMutation();

  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const handlingTimeoutRef = useRef(false);

  const pingBackend = useCallback(() => {
    const now = Date.now();
    if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatRef.current = now;
    void sessionHeartbeat().catch(() => undefined);
  }, [sessionHeartbeat]);

  const handleTimeout = useCallback(async () => {
    if (handlingTimeoutRef.current) return;
    handlingTimeoutRef.current = true;
    setShowWarning(false);

    try {
      await logout().unwrap();
    } catch {
      // Clear local state even if server session is already gone
    }

    endClientSession(dispatch, "session_timeout");
  }, [dispatch, logout]);

  const handleStaySignedIn = useCallback(async () => {
    try {
      await refreshSession().unwrap();
      lastActivityRef.current = Date.now();
      lastHeartbeatRef.current = Date.now();
      setShowWarning(false);
      handlingTimeoutRef.current = false;
    } catch {
      await handleTimeout();
    }
  }, [handleTimeout, refreshSession]);

  useEffect(() => {
    if (policyLoaded) {
      lastActivityRef.current = Date.now();
      lastHeartbeatRef.current = Date.now();
      void sessionHeartbeat().catch(() => undefined);
    }
  }, [policyLoaded, sessionHeartbeat]);

  useEffect(() => {
    const onActivity = () => {
      if (!showWarning) {
        lastActivityRef.current = Date.now();
        pingBackend();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [pingBackend, showWarning]);

  useEffect(() => {
    if (!policyLoaded || !policy) return;

    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= policy.idleTimeoutMs) {
        void handleTimeout();
        return;
      }

      if (idleMs >= policy.warningAtMs) {
        setShowWarning(true);
        setSecondsLeft(
          Math.max(0, Math.ceil((policy.idleTimeoutMs - idleMs) / 1000)),
        );
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [handleTimeout, policy, policyLoaded]);

  return (
    <>
      {children}
      <SessionTimeoutModal
        open={showWarning}
        secondsLeft={secondsLeft}
        onStaySignedIn={() => void handleStaySignedIn()}
        onSignOut={() => void handleTimeout()}
      />
    </>
  );
}
