// Global Data Cache with 60-minute refresh intervals
interface CachedData<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  source: string;
}

interface DataCacheConfig {
  refreshInterval: number; // 60 minutes in milliseconds
  maxAge: number;
}

class DataCache {
  private cache = new Map<string, CachedData<any>>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();
  
  private config: DataCacheConfig = {
    refreshInterval: 60 * 60 * 1000, // 60 minutes
    maxAge: 60 * 60 * 1000 // 60 minutes
  };

  // Store data with automatic expiration
  set<T>(key: string, data: T, source: string = 'unknown'): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxAge);
    
    const cachedData: CachedData<T> = {
      data,
      timestamp: now,
      expiresAt,
      source
    };
    
    this.cache.set(key, cachedData);
    
    // Clear existing timer if any
    if (this.refreshTimers.has(key)) {
      clearTimeout(this.refreshTimers.get(key)!);
    }
    
    console.log(`📦 Data cached: ${key} (expires: ${expiresAt.toLocaleTimeString()})`);
  }

  // Get data if not expired
  get<T>(key: string): CachedData<T> | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    const now = new Date();
    if (now > cached.expiresAt) {
      console.log(`⏰ Cache expired: ${key} (expired: ${cached.expiresAt.toLocaleTimeString()})`);
      this.cache.delete(key);
      return null;
    }
    
    return cached as CachedData<T>;
  }

  // Check if data exists and is fresh
  isValid(key: string): boolean {
    return this.get(key) !== null;
  }

  // Get cache metadata
  getMetadata(key: string): { timestamp: Date; expiresAt: Date; source: string; age: number } | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = new Date();
    const age = now.getTime() - cached.timestamp.getTime();
    
    return {
      timestamp: cached.timestamp,
      expiresAt: cached.expiresAt,
      source: cached.source,
      age: Math.floor(age / 1000) // age in seconds
    };
  }

  // Get all cache keys with their metadata
  getAllMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    Array.from(this.cache.entries()).forEach(([key, cached]) => {
      const now = new Date();
      const age = now.getTime() - cached.timestamp.getTime();
      const isExpired = now > cached.expiresAt;
      
      metadata[key] = {
        timestamp: cached.timestamp,
        expiresAt: cached.expiresAt,
        source: cached.source,
        age: Math.floor(age / 1000),
        isExpired,
        timeToExpiry: Math.max(0, cached.expiresAt.getTime() - now.getTime())
      };
    });
    
    return metadata;
  }

  // Clear expired entries
  cleanup(): void {
    const now = new Date();
    const toDelete: string[] = [];
    
    Array.from(this.cache.entries()).forEach(([key, cached]) => {
      if (now > cached.expiresAt) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => {
      this.cache.delete(key);
      if (this.refreshTimers.has(key)) {
        clearTimeout(this.refreshTimers.get(key)!);
        this.refreshTimers.delete(key);
      }
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} expired cache entries`);
    }
  }

  // Get the most recent global refresh timestamp
  getLatestRefreshTime(): Date | null {
    let latest: Date | null = null;
    
    Array.from(this.cache.entries()).forEach(([, cached]) => {
      if (!latest || cached.timestamp > latest) {
        latest = cached.timestamp;
      }
    });
    
    return latest;
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers.clear();
    console.log('🗑️ Cache cleared');
  }
}

// Global cache instance
export const dataCache = new DataCache();

// Automatic cleanup every 10 minutes
setInterval(() => {
  dataCache.cleanup();
}, 10 * 60 * 1000);

// Cache key constants
export const CACHE_KEYS = {
  TOKEN_PRICES: 'token_prices',
  YIELD_POOLS: 'yield_pools', 
  API_HEALTH: 'api_health',
  CLM_POSITIONS: 'clm_positions',
  ZERION_PORTFOLIO: 'zerion_portfolio',
  ETF_DATA: 'etf_data'
} as const;

export type CacheKey = typeof CACHE_KEYS[keyof typeof CACHE_KEYS];

// Helper functions for specific data types
export const cacheHelpers = {
  // Token prices with fallback
  async getTokenPrices(tokenIds: string[], fetcher: () => Promise<any>): Promise<any> {
    const cached = dataCache.get(CACHE_KEYS.TOKEN_PRICES);
    
    if (cached) {
      console.log(`✅ Using cached token prices (${Math.floor(cached.timestamp.getTime() / 1000)} seconds old)`);
      return cached.data;
    }
    
    console.log('🔄 Fetching fresh token prices...');
    try {
      const data = await fetcher();
      dataCache.set(CACHE_KEYS.TOKEN_PRICES, data, 'DeFiLlama/CoinGecko');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch token prices:', error);
      throw error;
    }
  },

  // Yield pools data
  async getYieldPools(fetcher: () => Promise<any>): Promise<any> {
    const cached = dataCache.get(CACHE_KEYS.YIELD_POOLS);
    
    if (cached) {
      console.log(`✅ Using cached yield pools (${Math.floor((Date.now() - cached.timestamp.getTime()) / 1000)} seconds old)`);
      return cached.data;
    }
    
    console.log('🔄 Fetching fresh yield pools...');
    try {
      const data = await fetcher();
      dataCache.set(CACHE_KEYS.YIELD_POOLS, data, 'DeFiLlama');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch yield pools:', error);
      throw error;
    }
  },

  // API health status
  async getAPIHealth(fetcher: () => Promise<any>): Promise<any> {
    const cached = dataCache.get(CACHE_KEYS.API_HEALTH);
    
    if (cached) {
      console.log(`✅ Using cached API health (${Math.floor((Date.now() - cached.timestamp.getTime()) / 1000)} seconds old)`);
      return cached.data;
    }
    
    console.log('🔄 Checking API health...');
    try {
      const data = await fetcher();
      dataCache.set(CACHE_KEYS.API_HEALTH, data, 'Internal Health Check');
      return data;
    } catch (error) {
      console.error('❌ Failed to check API health:', error);
      throw error;
    }
  },

  // Portfolio positions
  async getPortfolioPositions(fetcher: () => Promise<any>): Promise<any> {
    const cached = dataCache.get(CACHE_KEYS.ZERION_PORTFOLIO);
    
    if (cached) {
      console.log(`✅ Using cached portfolio (${Math.floor((Date.now() - cached.timestamp.getTime()) / 1000)} seconds old)`);
      return cached.data;
    }
    
    console.log('🔄 Fetching fresh portfolio positions...');
    try {
      const data = await fetcher();
      dataCache.set(CACHE_KEYS.ZERION_PORTFOLIO, data, 'Zerion API');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch portfolio positions:', error);
      throw error;
    }
  }
};

// Auto-refresh manager
export class AutoRefreshManager {
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing = false;

  // Start automatic refresh every 60 minutes
  startAutoRefresh(callback: () => Promise<void>): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      if (this.isRefreshing) {
        console.log('⏳ Refresh already in progress, skipping...');
        return;
      }

      this.isRefreshing = true;
      console.log('🔄 Auto-refresh started (60min interval)');
      
      try {
        await callback();
        console.log('✅ Auto-refresh completed');
      } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
      } finally {
        this.isRefreshing = false;
      }
    }, 60 * 60 * 1000); // 60 minutes

    console.log('⏰ Auto-refresh scheduled every 60 minutes');
  }

  // Stop automatic refresh
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('🛑 Auto-refresh stopped');
    }
  }

  // Manual refresh
  async manualRefresh(callback: () => Promise<void>): Promise<void> {
    if (this.isRefreshing) {
      console.log('⏳ Refresh already in progress');
      return;
    }

    this.isRefreshing = true;
    console.log('🔄 Manual refresh started');
    
    try {
      // Clear cache to force fresh data
      dataCache.clear();
      await callback();
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  // Check if currently refreshing
  get refreshing(): boolean {
    return this.isRefreshing;
  }
}

export const autoRefreshManager = new AutoRefreshManager();