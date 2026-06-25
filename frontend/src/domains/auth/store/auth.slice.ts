import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type User } from "../types/auth.types";
import type { PermissionRow } from "../types/permissions.types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  permissions: PermissionRow[];
  permissionsLoaded: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  permissions: [],
  permissionsLoaded: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setPermissions: (state, action: PayloadAction<PermissionRow[]>) => {
      state.permissions = action.payload;
      state.permissionsLoaded = true;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.permissions = [];
      state.permissionsLoaded = false;
    },
    // Alias used by base-api 401 interceptor
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.permissions = [];
      state.permissionsLoaded = false;
    },
  },
});

export const { setUser, setPermissions, clearUser, logout } = authSlice.actions;
export default authSlice.reducer;
