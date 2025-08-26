import { defiLlamaAPI, TARGET_CHAINS, Protocol, PoolData } from './defillama-api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataService {
  private cache = new Map<string, CacheEntry<any>>();
  private DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private LONG_TTL = 60 * 60 * 1000; // 1 hour

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  async getPoolMetrics() {
    const cacheKey = 'pool-metrics';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const chains = Object.values(TARGET_CHAINS);
      
      // Fetch data in parallel
      const [protocols, allChainsTvl, dexVolumes, pools] = await Promise.all([
        defiLlamaAPI.getProtocols(),
        defiLlamaAPI.getAllChainsTVL(),
        defiLlamaAPI.getDexVolumes(),
        defiLlamaAPI.getPools().catch(() => [] as PoolData[])
      ]);

      // Filter for target chains
      const targetProtocols = protocols.filter(p => 
        p.chains?.some(chain => chains.includes(chain.toLowerCase()))
      );

      const targetChainsTvl = allChainsTvl.filter((chain: any) => 
        chains.includes(chain.name?.toLowerCase())
      );

      const targetPools = pools.filter((pool: PoolData) => 
        chains.includes(pool.chain?.toLowerCase())
      );

      // Calculate aggregated metrics
      const totalTvl = targetChainsTvl.reduce((sum: number, chain: any) => 
        sum + (chain.tvl || 0), 0
      );

      const chainMetrics = chains.map(chainId => {
        const chainData = targetChainsTvl.find((c: any) => 
          c.name?.toLowerCase() === chainId
        );
        const chainProtocols = targetProtocols.filter(p => 
          p.chains?.includes(chainId)
        );
        const chainPools = targetPools.filter(p => 
          p.chain?.toLowerCase() === chainId
        );

        return {
          chain: chainId,
          tvl: chainData?.tvl || 0,
          tvlChange24h: chainData?.change_1d || 0,
          protocolCount: chainProtocols.length,
          poolCount: chainPools.length,
          topPools: chainPools
            .sort((a, b) => b.tvlUsd - a.tvlUsd)
            .slice(0, 5)
        };
      });

      const result = {
        totalTvl,
        chains: chainMetrics,
        topProtocols: targetProtocols
          .sort((a, b) => b.tvl - a.tvl)
          .slice(0, 20),
        timestamp: Date.now()
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching pool metrics:', error);
      throw error;
    }
  }

  async getChainDetails(chainId: string) {
    const cacheKey = `chain-${chainId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const [historicalTvl, protocols, dexVolume, pools] = await Promise.all([
        defiLlamaAPI.getChainTVL(chainId),
        defiLlamaAPI.getProtocolsByChain(chainId),
        defiLlamaAPI.getDexVolumeByChain(chainId).catch(() => null),
        defiLlamaAPI.getPools()
      ]);

      const chainPools = pools.filter((pool: PoolData) => 
        pool.chain?.toLowerCase() === chainId
      );

      // Get top pools by TVL
      const topPools = chainPools
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .slice(0, 20);

      // Get top yielding pools
      const topYieldPools = chainPools
        .filter(p => p.apy > 0)
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 10);

      const result = {
        chain: chainId,
        historicalTvl: historicalTvl.slice(-30), // Last 30 days
        protocols: protocols.slice(0, 50),
        pools: topPools,
        topYieldPools,
        dexVolume,
        metrics: {
          totalTvl: protocols.reduce((sum, p) => sum + (p.chainTvls[chainId] || 0), 0),
          protocolCount: protocols.length,
          poolCount: chainPools.length,
          avgApy: chainPools.length > 0 
            ? chainPools.reduce((sum, p) => sum + p.apy, 0) / chainPools.length 
            : 0
        },
        timestamp: Date.now()
      };

      this.setCache(cacheKey, result, this.LONG_TTL);
      return result;
    } catch (error) {
      console.error(`Error fetching chain details for ${chainId}:`, error);
      throw error;
    }
  }

  async getProtocolDetails(protocolId: string) {
    const cacheKey = `protocol-${protocolId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const details = await defiLlamaAPI.getProtocolDetails(protocolId);
      this.setCache(cacheKey, details, this.LONG_TTL);
      return details;
    } catch (error) {
      console.error(`Error fetching protocol details for ${protocolId}:`, error);
      throw error;
    }
  }

  async getTopYieldPools(minTvl: number = 100000) {
    const cacheKey = `top-yield-${minTvl}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const pools = await defiLlamaAPI.getPools();
      const chains = Object.values(TARGET_CHAINS);
      
      const filteredPools = pools
        .filter((pool: PoolData) => 
          chains.includes(pool.chain?.toLowerCase()) &&
          pool.tvlUsd >= minTvl &&
          pool.apy > 0 &&
          pool.apy < 1000 // Filter out unrealistic APYs
        )
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 50);

      this.setCache(cacheKey, filteredPools);
      return filteredPools;
    } catch (error) {
      console.error('Error fetching top yield pools:', error);
      throw error;
    }
  }

  async searchPools(query: string) {
    try {
      const pools = await defiLlamaAPI.getPools();
      const chains = Object.values(TARGET_CHAINS);
      
      return pools.filter((pool: PoolData) => 
        chains.includes(pool.chain?.toLowerCase()) &&
        (pool.symbol?.toLowerCase().includes(query.toLowerCase()) ||
         pool.project?.toLowerCase().includes(query.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching pools:', error);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export const dataService = new DataService();