import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface UiState {
  isSidebarOpen: boolean;
  isDarkMode: boolean;
  notifications: Notification[];
  activeModal: string | null;
}

const initialState: UiState = {
  isSidebarOpen: true,
  isDarkMode: false,
  notifications: [],
  activeModal: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarOpen = action.payload;
    },
    toggleDarkMode: (state) => {
      state.isDarkMode = !state.isDarkMode;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, "id">>) => {
      state.notifications.push({
        ...action.payload,
        id: Date.now().toString(),
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  toggleDarkMode,
  addNotification,
  removeNotification,
  openModal,
  closeModal,
} = uiSlice.actions;

export default uiSlice.reducer;
