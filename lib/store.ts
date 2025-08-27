import { create } from 'zustand';

interface AppState {
  viewMode: 'home' | 'pools' | 'perps' | 'dn model';
  setViewMode: (mode: 'home' | 'pools' | 'perps' | 'dn model') => void;
}

export const useAppStore = create<AppState>((set) => ({
  viewMode: 'home',
  setViewMode: (mode) => set({ viewMode: mode }),
}));