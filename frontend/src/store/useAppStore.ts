import { create } from "zustand";
import type { User } from "../types";

interface AppStore {
  mode: "start" | "wizard" | "chat" | "upgrade";
  setMode: (m: "start" | "wizard" | "chat" | "upgrade") => void;
  user: User | null;
  setUser: (u: User | null) => void;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  mode: localStorage.getItem("promptrx_seen") ? "wizard" : "start",
  setMode: (mode) => set({ mode }),
  user: null,
  setUser: (user) => set({ user }),
  token: localStorage.getItem("access_token"),
  login: (token, user) => {
    localStorage.setItem("access_token", token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    set({ token: null, user: null });
  },
}));
