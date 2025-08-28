import { create } from 'zustand';
import { dataCache, autoRefreshManager } from './data-cache';

interface AppState {
  viewMode: 'home' | 'pools' | 'dn model' | 'endpoints';
  setViewMode: (mode: 'home' | 'pools' | 'dn model' | 'endpoints') => void;
  
  // Global refresh state
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
  nextRefreshTime: Date | null;
  
  // Refresh actions
  setRefreshing: (refreshing: boolean) => void;
  setLastRefreshTime: (time: Date) => void;
  updateRefreshTimes: () => void;
  
  // Manual refresh
  triggerManualRefresh: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  viewMode: 'home',
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Initial refresh state
  isRefreshing: false,
  lastRefreshTime: null,
  nextRefreshTime: null,
  
  // Refresh actions
  setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  
  setLastRefreshTime: (time) => {
    const nextTime = new Date(time.getTime() + (60 * 60 * 1000)); // 60 minutes later
    set({ 
      lastRefreshTime: time,
      nextRefreshTime: nextTime
    });
  },
  
  updateRefreshTimes: () => {
    const latestCacheTime = dataCache.getLatestRefreshTime();
    if (latestCacheTime) {
      const nextTime = new Date(latestCacheTime.getTime() + (60 * 60 * 1000));
      set({
        lastRefreshTime: latestCacheTime,
        nextRefreshTime: nextTime
      });
    }
  },
  
  // Manual refresh function
  triggerManualRefresh: async () => {
    const state = get();
    if (state.isRefreshing) {
      console.log('⏳ Refresh already in progress');
      return;
    }

    set({ isRefreshing: true });
    
    try {
      await autoRefreshManager.manualRefresh(async () => {
        // This will be populated by each component's refresh logic
        console.log('🔄 Manual refresh triggered from store');
        
        // Clear cache to force fresh data
        dataCache.clear();
        
        // Update times
        const now = new Date();
        const nextTime = new Date(now.getTime() + (60 * 60 * 1000));
        set({ 
          lastRefreshTime: now,
          nextRefreshTime: nextTime
        });
      });
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      set({ isRefreshing: false });
    }
  }
}));

// Initialize refresh times on store creation
setTimeout(() => {
  useAppStore.getState().updateRefreshTimes();
}, 100);