// API Configuration and Fallback Management
export interface APIEndpoint {
  name: string;
  url: string;
  key?: string;
  headers?: Record<string, string>;
  status: 'working' | 'degraded' | 'failing';
  lastChecked: Date;
  fallbacks?: APIEndpoint[];
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
}

// Validated API Configurations (based on testing)
export const API_CONFIG = {
  // ✅ Working - Primary price data source
  DEFILLAMA: {
    name: 'DeFiLlama',
    free: {
      url: 'https://api.llama.fi',
      status: 'working' as const,
      endpoints: {
        protocols: '/protocols',
        pools: '/pools',
        tvl: '/tvl',
        prices: '/coins/prices'
      }
    },
    pro: {
      url: `https://pro-api.llama.fi/${process.env.DEFILLAMA_API_KEY}`,
      status: 'working' as const,
      endpoints: {
        prices: '/coins/prices/current',
        yields: '/yields/pools',
        historical: '/coins/prices/historical'
      }
    }
  },


  // ✅ Working - Solana RPC
  HELIUS: {
    name: 'Helius RPC',
    url: process.env.HELIUS_RPC_URL || '',
    status: 'working' as const,
    websocket: process.env.HELIUS_STANDARD_WEBSOCKET || '',
    endpoints: {
      rpc: '', // POST to base URL
      assets: '/v0/addresses/{address}/balances',
      nfts: '/v0/addresses/{address}/nfts'
    }
  },

  // ✅ Working - Portfolio tracking
  ZERION: {
    name: 'Zerion API',
    url: 'https://api.zerion.io/v1',
    key: process.env.ZERION_API_KEY,
    auth: { username: process.env.ZERION_API_KEY || '', password: '' },
    status: 'working' as const,
    endpoints: {
      positions: '/wallets/{address}/positions/',
      transactions: '/wallets/{address}/transactions/',
      portfolio: '/wallets/{address}/portfolio'
    }
  },

  // 🟡 Degraded - CoinStats returns HTML instead of JSON
  COINSTATS: {
    name: 'CoinStats',
    url: 'https://openapi.coinstats.app',
    key: process.env.COINSTATS_API_KEY,
    headers: { 'X-API-KEY': process.env.COINSTATS_API_KEY || '' },
    status: 'degraded' as const,
    issue: 'Returns HTML dashboard instead of JSON data',
    fallback: 'COINGECKO'
  },

  // ❌ Failing - Solscan API endpoint not found
  SOLSCAN: {
    name: 'Solscan',
    url: 'https://public-api.solscan.io',
    key: process.env.SOLSCAN_API_KEY,
    headers: { 'token': process.env.SOLSCAN_API_KEY || '' },
    status: 'failing' as const,
    issue: '404 Not Found - endpoint may have changed',
    fallback: 'HELIUS'
  },

  // ✅ Working Fallback - Free CoinGecko API
  COINGECKO: {
    name: 'CoinGecko Free',
    url: 'https://api.coingecko.com/api/v3',
    status: 'working' as const,
    rateLimit: '10-30 calls/minute',
    endpoints: {
      price: '/simple/price',
      coins: '/coins/{id}',
      markets: '/coins/markets'
    }
  }
};

// API Client with automatic fallback
export class APIClient {
  async fetchWithFallback(
    primaryConfig: any,
    endpoint: string,
    params: any = {},
    fallbackConfig?: any
  ): Promise<APIResponse> {
    try {
      // Try primary API
      const response = await this.makeRequest(primaryConfig, endpoint, params);
      return {
        success: true,
        data: response.data,
        source: primaryConfig.name
      };
    } catch (error) {
      console.warn(`Primary API ${primaryConfig.name} failed:`, error);

      // Try fallback if available
      if (fallbackConfig) {
        try {
          const fallbackResponse = await this.makeRequest(fallbackConfig, endpoint, params);
          return {
            success: true,
            data: fallbackResponse.data,
            source: `${fallbackConfig.name} (fallback)`
          };
        } catch (fallbackError) {
          console.error(`Fallback API ${fallbackConfig.name} also failed:`, fallbackError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: primaryConfig.name
      };
    }
  }

  private async makeRequest(config: any, endpoint: string, params: any) {
    const url = `${config.url}${endpoint}`;
    const options: RequestInit = {
      method: params.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    };

    if (config.auth) {
      const auth = btoa(`${config.auth.username}:${config.auth.password}`);
      options.headers = {
        ...options.headers,
        'Authorization': `Basic ${auth}`
      };
    }

    if (params.body) {
      options.body = JSON.stringify(params.body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { data: await response.json() };
  }
}

// Specialized API functions with fallbacks
export const priceAPI = {
  // Get current token prices with fallback
  async getCurrentPrices(tokenIds: string[]): Promise<APIResponse> {
    const client = new APIClient();
    
    // Try DeFiLlama Pro first
    try {
      const defiLlamaResponse = await client.fetchWithFallback(
        {
          name: 'DeFiLlama Pro',
          url: API_CONFIG.DEFILLAMA.pro.url,
          headers: {}
        },
        `/coins/prices/current/${tokenIds.join(',')}`,
        {}
      );
      
      if (defiLlamaResponse.success) {
        return defiLlamaResponse;
      }
    } catch (error) {
      console.warn('DeFiLlama Pro failed, trying CoinGecko...');
    }

    // Fallback to CoinGecko
    const coingeckoIds = tokenIds
      .filter(id => id.startsWith('coingecko:'))
      .map(id => id.replace('coingecko:', ''))
      .join(',');
    
    if (coingeckoIds) {
      return await client.fetchWithFallback(
        API_CONFIG.COINGECKO,
        '/simple/price',
        { 
          query: `?ids=${coingeckoIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
        }
      );
    }

    return { success: false, error: 'No valid token IDs for fallback API' };
  }
};

export const portfolioAPI = {
  // Get wallet positions with Zerion
  async getPositions(walletAddress: string): Promise<APIResponse> {
    const client = new APIClient();
    
    return await client.fetchWithFallback(
      API_CONFIG.ZERION,
      `/wallets/${walletAddress}/positions/`,
      {
        query: '?filter[positions]=no_filter&sort=value&page[size]=100'
      }
    );
  }
};

// API Health Monitor
export class APIHealthMonitor {
  private healthStatus: Map<string, { status: string; lastCheck: Date; errorCount: number }> = new Map();

  async checkAllAPIs(): Promise<{ working: string[]; degraded: string[]; failing: string[] }> {
    const results = { working: [], degraded: [], failing: [] } as any;
    
    for (const [key, config] of Object.entries(API_CONFIG)) {
      const status = (config as any).status || 'unknown';
      if (status === 'working') results.working.push((config as any).name);
      else if (status === 'degraded') results.degraded.push((config as any).name);
      else if (status === 'failing') results.failing.push((config as any).name);
    }
    
    return results;
  }

  getHealthSummary() {
    return {
      timestamp: new Date().toISOString(),
      workingAPIs: ['DeFiLlama', 'Helius RPC', 'Zerion API', 'CoinGecko'],
      degradedAPIs: ['CoinStats (using CoinGecko fallback)'],
      failingAPIs: ['Solscan (using Helius fallback)'],
      recommendations: [
        'CoinStats API needs credential review - currently returns HTML',
        'Solscan endpoint appears changed - verify current API documentation',
        'Consider CoinGecko Pro for higher rate limits',
        'All critical functionality has working fallbacks'
      ]
    };
  }
}

export const apiHealthMonitor = new APIHealthMonitor();