import axios from 'axios';

const BASE_URL = 'https://api.llama.fi';
const PRO_BASE_URL = 'https://pro-api.llama.fi';

export interface ChainTvl {
  date: number;
  totalLiquidityUSD: number;
}

export interface Protocol {
  id: string;
  name: string;
  address: string;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  logo: string;
  audits: string;
  audit_note: string;
  gecko_id: string;
  cmcId: string;
  category: string;
  chains: string[];
  module: string;
  twitter: string;
  forkedFrom: string[];
  oracles: string[];
  listedAt: number;
  methodology: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  tokenBreakdowns: Record<string, any>;
  mcap: number;
}

export interface DexVolume {
  totalVolume: number;
  changeVolume1d: number;
  changeVolume7d: number;
  changeVolume30d: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  name: string;
  displayName: string;
  disabled: boolean;
  module: string;
  category: string;
  logo: string;
  chains: string[];
}

export interface PoolData {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  rewardTokens: string[];
  underlyingTokens: string[];
  poolMeta: string;
  url: string;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  volumeUsd1d: number;
  volumeUsd7d: number;
}

export interface StablePool {
  id: string;
  symbol: string;
  chain: string;
  address: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  volumeUsd1d: number;
  volumeUsd7d: number;
}

class DefiLlamaAPI {
  private axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  private proAxiosInstance = axios.create({
    baseURL: `${PRO_BASE_URL}/${process.env.DEFILLAMA_API_KEY || process.env.NEXT_PUBLIC_DEFILLAMA_API_KEY}`,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  // Get all protocols with TVL
  async getProtocols(): Promise<Protocol[]> {
    const { data } = await this.axiosInstance.get('/protocols');
    return data;
  }

  // Get TVL for specific protocol
  async getProtocolTVL(protocol: string): Promise<number> {
    const { data } = await this.axiosInstance.get(`/tvl/${protocol}`);
    return data;
  }

  // Get historical TVL for a specific chain
  async getChainTVL(chain: string): Promise<ChainTvl[]> {
    const { data } = await this.axiosInstance.get(`/v2/historicalChainTvl/${chain}`);
    return data;
  }

  // Get current TVL across all chains
  async getAllChainsTVL(): Promise<any[]> {
    const { data } = await this.axiosInstance.get('/v2/chains');
    return data;
  }

  // Get DEX volumes overview
  async getDexVolumes(): Promise<any> {
    const { data } = await this.axiosInstance.get('/overview/dexs');
    return data;
  }

  // Get DEX volume for specific chain
  async getDexVolumeByChain(chain: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/overview/dexs/${chain}`);
    return data;
  }

  // Get pools data (limited data from free API)
  async getPools(): Promise<PoolData[]> {
    const { data } = await this.axiosInstance.get('/pools');
    return data.data;
  }

  // Get stablecoin pools
  async getStablecoinPools(): Promise<any> {
    const { data } = await this.axiosInstance.get('/stablecoins/pools');
    return data;
  }

  // Get fees and revenue overview
  async getFees(): Promise<any> {
    const { data } = await this.axiosInstance.get('/overview/fees');
    return data;
  }

  // Get fees for specific chain
  async getFeesByChain(chain: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/overview/fees/${chain}`);
    return data;
  }

  // Get specific protocol details
  async getProtocolDetails(protocol: string): Promise<any> {
    const { data } = await this.axiosInstance.get(`/protocol/${protocol}`);
    return data;
  }

  // Filter protocols by chain
  async getProtocolsByChain(chain: string): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols.filter(p => 
      p.chains && p.chains.includes(chain) && p.chainTvls[chain] > 0
    );
  }

  // Get top protocols by TVL for specific chains
  async getTopProtocolsByChains(
    chains: string[], 
    limit: number = 10
  ): Promise<Record<string, Protocol[]>> {
    const allProtocols = await this.getProtocols();
    const result: Record<string, Protocol[]> = {};

    for (const chain of chains) {
      const chainProtocols = allProtocols
        .filter(p => p.chains && p.chains.includes(chain) && p.chainTvls[chain] > 0)
        .sort((a, b) => (b.chainTvls[chain] || 0) - (a.chainTvls[chain] || 0))
        .slice(0, limit);
      
      result[chain] = chainProtocols;
    }

    return result;
  }

  // Get aggregated metrics for target chains
  async getChainMetrics(chains: string[]): Promise<any> {
    const [allChainsTvl, dexVolumes] = await Promise.all([
      this.getAllChainsTVL(),
      this.getDexVolumes()
    ]);

    const targetChainsTvl = allChainsTvl.filter(chain => 
      chains.includes(chain.name.toLowerCase())
    );

    const targetDexVolumes = dexVolumes.chains?.filter((chain: any) => 
      chains.includes(chain.name.toLowerCase())
    );

    return {
      tvl: targetChainsTvl,
      dexVolumes: targetDexVolumes
    };
  }

  // Get current token prices (Pro API with CoinGecko fallback)
  async getCurrentPrices(coins: string[]): Promise<any> {
    // Import cache helpers dynamically to avoid circular dependencies
    const { cacheHelpers } = await import('./data-cache');
    
    return await cacheHelpers.getTokenPrices(coins, async () => {
      try {
        // Try DeFiLlama Pro API first
        const coinsParam = coins.join(',');
        const { data } = await this.proAxiosInstance.get(`/coins/prices/current/${coinsParam}`);
        console.log('✅ DeFiLlama Pro API: Token prices fetched successfully');
        return data;
      } catch (error) {
        console.warn('⚠️ DeFiLlama Pro API failed, trying CoinGecko fallback...', error);
        
        try {
          // Fallback to CoinGecko free API
          const coingeckoIds = coins
            .filter(id => id.startsWith('coingecko:'))
            .map(id => id.replace('coingecko:', ''))
            .join(',');
          
          if (!coingeckoIds) {
            throw new Error('No CoinGecko compatible coin IDs provided');
          }

          const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
              ids: coingeckoIds,
              vs_currencies: 'usd',
              include_24hr_change: true,
              include_market_cap: true
            },
            timeout: 10000
          });

          // Transform CoinGecko response to match DeFiLlama format
          const transformed = {
            coins: {}
          } as any;

          Object.entries(response.data).forEach(([coinId, data]: [string, any]) => {
            const defiLlamaId = `coingecko:${coinId}`;
            transformed.coins[defiLlamaId] = {
              price: data.usd,
              mcap: data.usd_market_cap || null,
              change_24h: data.usd_24h_change || null,
              symbol: coinId.toUpperCase(),
              timestamp: Math.floor(Date.now() / 1000)
            };
          });

          console.log('✅ CoinGecko fallback: Token prices fetched successfully');
          return transformed;
          
        } catch (fallbackError) {
          console.error('❌ Both DeFiLlama Pro and CoinGecko failed:', fallbackError);
          return { coins: {} };
        }
      }
    });
  }

  // Get token price changes (Pro API)
  async getPriceChanges(coins: string[]): Promise<any> {
    try {
      const coinsParam = coins.join(',');
      const { data } = await this.proAxiosInstance.get(`/coins/percentage/${coinsParam}`);
      return data;
    } catch (error) {
      console.error('Error fetching price changes from Pro API:', error);
      return {};
    }
  }

  // Get historical prices (Pro API)
  async getHistoricalPrices(coins: string[], timestamp: number): Promise<any> {
    try {
      const coinsParam = coins.join(',');
      const { data } = await this.proAxiosInstance.get(`/coins/prices/historical/${timestamp}/${coinsParam}`);
      return data;
    } catch (error) {
      console.error('Error fetching historical prices from Pro API:', error);
      return {};
    }
  }

  // Get price charts (Pro API)
  async getPriceCharts(coins: string[]): Promise<any> {
    try {
      const coinsParam = coins.join(',');
      const { data } = await this.proAxiosInstance.get(`/coins/chart/${coinsParam}`);
      return data;
    } catch (error) {
      console.error('Error fetching price charts from Pro API:', error);
      return {};
    }
  }

  // Get yield pools data (Pro API)
  async getYieldPools(): Promise<any> {
    // Import cache helpers dynamically to avoid circular dependencies
    const { cacheHelpers } = await import('./data-cache');
    
    return await cacheHelpers.getYieldPools(async () => {
      try {
        const { data } = await this.proAxiosInstance.get('/yields/pools');
        console.log('✅ DeFiLlama Pro API: Yield pools fetched successfully');
        return data;
      } catch (error) {
        console.error('❌ Error fetching yield pools from Pro API:', error);
        return { data: [] };
      }
    });
  }

  // Get pool chart data (Pro API)
  async getPoolChart(poolId: string): Promise<any> {
    try {
      const { data } = await this.proAxiosInstance.get(`/yields/chart/${poolId}`);
      return data;
    } catch (error) {
      console.error(`Error fetching pool chart for ${poolId} from Pro API:`, error);
      return {};
    }
  }

  // Get derivatives/perpetuals overview
  async getDerivativesOverview(): Promise<any> {
    try {
      const { data } = await this.axiosInstance.get('/overview/derivatives');
      return data;
    } catch (error) {
      console.error('Error fetching derivatives overview:', error);
      return {};
    }
  }

  // Get DEX perpetuals only (filtered from derivatives)
  async getDEXPerpetuals(): Promise<any> {
    try {
      const data = await this.getDerivativesOverview();
      
      if (!data.protocols) {
        return { protocols: [] };
      }

      // Filter for DEX-only protocols (exclude CEXes)
      const dexProtocols = data.protocols.filter((protocol: any) => {
        const name = protocol.name?.toLowerCase() || '';
        const category = protocol.category?.toLowerCase() || '';
        
        // Exclude known CEXes and include only derivatives/perps
        const isCEX = name.includes('binance') || 
                     name.includes('bybit') || 
                     name.includes('okx') || 
                     name.includes('coinbase') ||
                     name.includes('kraken') ||
                     name.includes('bitget') ||
                     name.includes('kucoin') ||
                     name.includes('huobi') ||
                     name.includes('mexc') ||
                     category.includes('cex');
        
        const isDerivatives = category.includes('derivatives') || 
                            name.includes('perp') || 
                            name.includes('perpetual') ||
                            name.includes('futures') ||
                            category.includes('synthetics');
        
        return !isCEX && isDerivatives && protocol.total24h > 0;
      });

      return {
        ...data,
        protocols: dexProtocols
      };
    } catch (error) {
      console.error('Error fetching DEX perpetuals:', error);
      return { protocols: [] };
    }
  }

  // Get individual perpetual contracts from multiple protocols
  async getIndividualPerpetualContracts(): Promise<any> {
    try {
      const allContracts: any[] = [];

      // 1. Get Hyperliquid perpetual contracts
      try {
        const hyperliquidResponse = await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'meta' })
        });
        
        const hyperliquidData = await hyperliquidResponse.json();
        
        if (hyperliquidData?.universe) {
          hyperliquidData.universe.forEach((market: any) => {
            allContracts.push({
              protocol: 'Hyperliquid',
              chain: 'Hyperliquid L1',
              pair: `${market.name}-USD`,
              baseCurrency: market.name,
              quoteCurrency: 'USD',
              maxLeverage: market.maxLeverage || 20,
              volume24h: 0, // Would need additional API calls
              isActive: !market.isDelisted,
              category: 'Perpetual',
              logo: 'https://hyperliquid.xyz/favicon.ico'
            });
          });
        }
      } catch (error) {
        console.warn('Hyperliquid API error:', error);
      }


      // 3. Add known major contracts from other protocols (estimated data)
      const knownContracts = [
        // Jupiter Perpetual (Solana)
        { protocol: 'Jupiter Perpetual', chain: 'Solana', pair: 'BTC-USD', baseCurrency: 'BTC', quoteCurrency: 'USD', maxLeverage: 10 },
        { protocol: 'Jupiter Perpetual', chain: 'Solana', pair: 'ETH-USD', baseCurrency: 'ETH', quoteCurrency: 'USD', maxLeverage: 10 },
        { protocol: 'Jupiter Perpetual', chain: 'Solana', pair: 'SOL-USD', baseCurrency: 'SOL', quoteCurrency: 'USD', maxLeverage: 10 },
        
        // Drift Trade (Solana)
        { protocol: 'Drift Trade', chain: 'Solana', pair: 'BTC-USD', baseCurrency: 'BTC', quoteCurrency: 'USD', maxLeverage: 10 },
        { protocol: 'Drift Trade', chain: 'Solana', pair: 'ETH-USD', baseCurrency: 'ETH', quoteCurrency: 'USD', maxLeverage: 10 },
        { protocol: 'Drift Trade', chain: 'Solana', pair: 'SOL-USD', baseCurrency: 'SOL', quoteCurrency: 'USD', maxLeverage: 10 },
        
        // dYdX V4
        { protocol: 'dYdX V4', chain: 'dYdX', pair: 'BTC-USD', baseCurrency: 'BTC', quoteCurrency: 'USD', maxLeverage: 20 },
        { protocol: 'dYdX V4', chain: 'dYdX', pair: 'ETH-USD', baseCurrency: 'ETH', quoteCurrency: 'USD', maxLeverage: 20 },
        
        // Orderly Perps
        { protocol: 'Orderly Perps', chain: 'Ethereum', pair: 'BTC-USDC', baseCurrency: 'BTC', quoteCurrency: 'USDC', maxLeverage: 25 },
        { protocol: 'Orderly Perps', chain: 'Ethereum', pair: 'ETH-USDC', baseCurrency: 'ETH', quoteCurrency: 'USDC', maxLeverage: 25 },
      ];

      knownContracts.forEach(contract => {
        allContracts.push({
          ...contract,
          volume24h: 0,
          isEstimated: true,
          category: 'Perpetual',
          logo: `https://defillama.com/icons/protocols/${contract.protocol.toLowerCase().replace(/\s+/g, '-')}.jpg`
        });
      });

      return {
        contracts: allContracts,
        total: allContracts.length,
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error fetching individual perpetual contracts:', error);
      return { contracts: [], total: 0 };
    }
  }
}

export const defiLlamaAPI = new DefiLlamaAPI();

// Chain identifiers for your target chains
export const TARGET_CHAINS = {
  // Ethereum L1
  ETHEREUM: 'ethereum',
  
  // Ethereum L2s
  ARBITRUM: 'arbitrum',
  OPTIMISM: 'optimism',
  BASE: 'base',
  POLYGON: 'polygon',
  
  // Other chains
  SOLANA: 'solana',
  SUI: 'sui'
};

export const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  ethereum: 'Ethereum',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  base: 'Base',
  polygon: 'Polygon',
  solana: 'Solana',
  sui: 'Sui'
};

// Major DeFi and chain tokens to track
export const TRACKED_TOKENS = [
  // Chain native tokens
  { id: 'coingecko:ethereum', symbol: 'ETH', name: 'Ethereum', category: 'Layer 1' },
  { id: 'coingecko:solana', symbol: 'SOL', name: 'Solana', category: 'Layer 1' },
  { id: 'coingecko:matic-network', symbol: 'MATIC', name: 'Polygon', category: 'Layer 2' },
  { id: 'coingecko:sui', symbol: 'SUI', name: 'Sui', category: 'Layer 1' },
  
  // Major stablecoins
  { id: 'ethereum:0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai', category: 'Stablecoin' },
  { id: 'ethereum:0xA0b86a33E6417c3c8C2bE44B9bC2C65B6F7F4a6b', symbol: 'USDC', name: 'USD Coin', category: 'Stablecoin' },
  { id: 'ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', category: 'Stablecoin' },
  
  // Top DeFi protocol tokens
  { id: 'ethereum:0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave', category: 'Lending' },
  { id: 'ethereum:0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', category: 'DEX' },
  { id: 'ethereum:0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', symbol: 'SUSHI', name: 'SushiSwap', category: 'DEX' },
  { id: 'ethereum:0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', symbol: 'MKR', name: 'Maker', category: 'DeFi' },
  { id: 'ethereum:0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', symbol: 'ENS', name: 'Ethereum Name Service', category: 'Utility' },
  { id: 'coingecko:chainlink', symbol: 'LINK', name: 'Chainlink', category: 'Oracle' },
  { id: 'coingecko:wrapped-bitcoin', symbol: 'WBTC', name: 'Wrapped Bitcoin', category: 'Asset' },
];

// Token display configuration
export const TOKEN_DISPLAY_CONFIG = {
  'Layer 1': { color: 'bg-blue-100 text-blue-800', icon: '⛓️' },
  'Layer 2': { color: 'bg-purple-100 text-purple-800', icon: '🔗' },
  'DEX': { color: 'bg-green-100 text-green-800', icon: '🔄' },
  'Lending': { color: 'bg-orange-100 text-orange-800', icon: '🏦' },
  'Stablecoin': { color: 'bg-gray-100 text-gray-800', icon: '💵' },
  'DeFi': { color: 'bg-indigo-100 text-indigo-800', icon: '📊' },
  'Utility': { color: 'bg-pink-100 text-pink-800', icon: '🛠️' },
  'Oracle': { color: 'bg-yellow-100 text-yellow-800', icon: '🔮' },
  'Asset': { color: 'bg-red-100 text-red-800', icon: '💎' }
};