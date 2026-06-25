"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/domains/auth";

type RoleContextValue = {
  userRole: string;
};

const RoleContext = createContext<RoleContextValue>({
  userRole: "engineer",
});

/** Display-only role label synced from authenticated user. */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState("engineer");

  useEffect(() => {
    if (user?.backendRoleCode) {
      setUserRole(user.backendRoleCode);
    }
  }, [user]);

  return (
    <RoleContext.Provider value={{ userRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
