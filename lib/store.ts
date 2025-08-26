import { create } from 'zustand';
import { TARGET_CHAINS } from './defillama-api';

interface AppState {
  selectedChains: string[];
  selectedProtocol: string | null;
  viewMode: 'overview' | 'chain' | 'protocol' | 'yields';
  timeRange: '24h' | '7d' | '30d' | '90d';
  minTvlFilter: number;
  searchQuery: string;
  
  // Actions
  toggleChain: (chain: string) => void;
  setSelectedProtocol: (protocol: string | null) => void;
  setViewMode: (mode: 'overview' | 'chain' | 'protocol' | 'yields') => void;
  setTimeRange: (range: '24h' | '7d' | '30d' | '90d') => void;
  setMinTvlFilter: (amount: number) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedChains: Object.values(TARGET_CHAINS),
  selectedProtocol: null,
  viewMode: 'overview',
  timeRange: '7d',
  minTvlFilter: 100000,
  searchQuery: '',
  
  toggleChain: (chain) => set((state) => ({
    selectedChains: state.selectedChains.includes(chain)
      ? state.selectedChains.filter(c => c !== chain)
      : [...state.selectedChains, chain]
  })),
  
  setSelectedProtocol: (protocol) => set({ selectedProtocol: protocol }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTimeRange: (range) => set({ timeRange: range }),
  setMinTvlFilter: (amount) => set({ minTvlFilter: amount }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  resetFilters: () => set({
    selectedChains: Object.values(TARGET_CHAINS),
    selectedProtocol: null,
    minTvlFilter: 100000,
    searchQuery: ''
  })
}));