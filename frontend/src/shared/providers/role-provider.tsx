"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/domains/auth";

type RoleContextValue = {
  userRole: string;
  setUserRole: (role: string) => void;
};

const RoleContext = createContext<RoleContextValue>({
  userRole: "super_admin",
  setUserRole: () => {},
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState("super_admin");

  // Sync with user's primary role when loaded
  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setUserRole(user.roles[0]);
    }
  }, [user]);

  return (
    <RoleContext.Provider value={{ userRole, setUserRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
