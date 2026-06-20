import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api as baseApi } from "@/core/api/api";
import authReducer from "@/domains/auth/store/auth.slice";
import uiReducer from "./slices/ui.slice";

// ---------------------------------------------------------------------------
// Root Store — imports slices from each domain.
// Deleting a domain means deleting its folder; no changes needed here.
// ---------------------------------------------------------------------------
export const store = configureStore({
  reducer: {
    // RTK Query cache (core infrastructure)
    [baseApi.reducerPath]: baseApi.reducer,

    // Domain slices
    auth: authReducer,

    // Cross-cutting UI state
    ui: uiReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
