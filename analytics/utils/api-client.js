// API client utilities for CLM Analytics
// Rate-limited clients for GeckoTerminal and DeFiLlama APIs

class RateLimitedAPIClient {
    constructor(baseURL, rateLimit = 30, windowMs = 60000) {
        this.baseURL = baseURL;
        this.rateLimit = rateLimit; // requests per window
        this.windowMs = windowMs; // time window in ms
        this.requestQueue = [];
        this.serviceName = this.getServiceName(baseURL);
    }

    getServiceName(url) {
        if (url.includes('geckoterminal.com')) return 'geckoterminal';
        if (url.includes('llama.fi')) return 'defillama';
        return 'unknown';
    }

    async get(endpoint, params = {}) {
        await this.throttle();
        
        // Ensure proper URL construction
        const fullUrl = this.baseURL.endsWith('/') && endpoint.startsWith('/') 
            ? this.baseURL + endpoint.slice(1)
            : this.baseURL + endpoint;
        
        const url = new URL(fullUrl);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            console.log(`🔄 API Request: ${this.serviceName} - ${url.toString()}`);
            
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                console.error(`❌ API Request failed: ${url.toString()}`);
                console.error(`❌ Response status: ${response.status} ${response.statusText}`);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Track successful API usage
            if (global.analyticsDB) {
                await global.analyticsDB.trackAPIUsage(this.serviceName, url.pathname);
            }
            
            return data;
            
        } catch (error) {
            console.error(`❌ API Error (${this.serviceName}):`, error.message);
            throw error;
        }
    }

    async throttle() {
        const now = Date.now();
        
        // Remove old requests outside the window
        this.requestQueue = this.requestQueue.filter(time => now - time < this.windowMs);
        
        // If we've hit the rate limit, wait
        if (this.requestQueue.length >= this.rateLimit) {
            const oldestRequest = this.requestQueue[0];
            const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms buffer
            
            console.log(`⏳ Rate limit reached for ${this.serviceName}, waiting ${Math.round(waitTime/1000)}s`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Retry throttle check after waiting
            return this.throttle();
        }
        
        this.requestQueue.push(now);
    }

    async getUsageStats() {
        if (global.analyticsDB) {
            const hourlyUsage = await global.analyticsDB.getAPIUsage(this.serviceName, 1);
            return {
                service: this.serviceName,
                hourlyUsage: hourlyUsage,
                rateLimit: this.rateLimit,
                remaining: Math.max(0, this.rateLimit - this.requestQueue.length)
            };
        }
        return null;
    }
}

// GeckoTerminal API client
class GeckoTerminalClient extends RateLimitedAPIClient {
    constructor() {
        super('https://api.geckoterminal.com/api/v2', 30, 60000); // 30 requests per minute
    }

    async getNetworks() {
        return this.get('/networks');
    }

    async getPoolsForNetwork(network, page = 1) {
        return this.get(`/networks/${network}/pools`, { page });
    }

    async getOHLCV(network, poolAddress, timeframe = 'hour', limit = 100) {
        return this.get(`/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}`, { limit });
    }

    async getPoolData(network, poolAddress) {
        return this.get(`/networks/${network}/pools/${poolAddress}`);
    }

    async getTopPools(network = 'eth', limit = 100) {
        // GeckoTerminal limits to 20 pools per page
        const perPage = 20;
        const pages = Math.ceil(limit / perPage);
        let allPools = [];
        
        for (let page = 1; page <= pages; page++) {
            const response = await this.get(`/networks/${network}/pools`, { 
                page: page
            });
            
            if (response?.data) {
                allPools.push(...response.data);
            }
            
            // Stop if we have enough pools
            if (allPools.length >= limit) {
                break;
            }
            
            // Add delay between pages to be respectful
            if (page < pages) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return { data: allPools.slice(0, limit) };
    }

    // Specialized method for historical data collection
    async getHistoricalOHLCV(network, poolAddress, days = 30) {
        try {
            // GeckoTerminal provides up to 6 months of hourly data
            const maxDataPoints = Math.min(days * 24, 1000); // API limit
            const hoursPerRequest = 100; // API limit per request
            const requests = Math.ceil(maxDataPoints / hoursPerRequest);
            
            let allData = [];
            
            for (let i = 0; i < requests; i++) {
                const response = await this.getOHLCV(network, poolAddress, 'hour', hoursPerRequest);
                
                if (response.data?.attributes?.ohlcv_list) {
                    allData.push(...response.data.attributes.ohlcv_list);
                }
                
                // Add delay between requests to be respectful
                if (i < requests - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // Sort by timestamp (oldest first)
            allData.sort((a, b) => a[0] - b[0]);
            
            // Limit to requested days
            const cutoffTime = Date.now() / 1000 - (days * 24 * 3600);
            allData = allData.filter(candle => candle[0] >= cutoffTime);
            
            return allData;
            
        } catch (error) {
            console.error(`❌ Error fetching historical OHLCV for ${poolAddress}:`, error.message);
            return [];
        }
    }
}

// DeFiLlama API client
class DeFiLlamaClient extends RateLimitedAPIClient {
    constructor() {
        super('https://yields.llama.fi', 100, 3600000); // More generous limits
    }

    async getAllPools() {
        return this.get('/pools');
    }

    async getPoolsByChain(chain) {
        const response = await this.getAllPools();
        if (response.status === 'success' && response.data) {
            return response.data.filter(pool => pool.chain.toLowerCase() === chain.toLowerCase());
        }
        return [];
    }

    async getTopPoolsByTVL(minTVL = 1000000, limit = 100) {
        try {
            const response = await this.getAllPools();
            
            if (response.status === 'success' && response.data) {
                return response.data
                    .filter(pool => pool.tvlUsd >= minTVL)
                    .sort((a, b) => b.tvlUsd - a.tvlUsd)
                    .slice(0, limit);
            }
            
            return [];
        } catch (error) {
            console.error('❌ Error fetching top pools from DeFiLlama:', error.message);
            return [];
        }
    }

    async searchPoolsByTokens(token0, token1) {
        try {
            const response = await this.getAllPools();
            
            if (response.status === 'success' && response.data) {
                return response.data.filter(pool => {
                    const symbols = pool.symbol ? pool.symbol.toLowerCase() : '';
                    const t0 = token0.toLowerCase();
                    const t1 = token1.toLowerCase();
                    
                    return symbols.includes(t0) && symbols.includes(t1);
                });
            }
            
            return [];
        } catch (error) {
            console.error('❌ Error searching pools:', error.message);
            return [];
        }
    }
}

// Network configuration
const NETWORK_CONFIG = {
    eth: {
        geckoTerminal: 'eth',
        defillama: 'Ethereum',
        name: 'Ethereum'
    },
    arbitrum: {
        geckoTerminal: 'arbitrum',
        defillama: 'Arbitrum',
        name: 'Arbitrum'
    },
    base: {
        geckoTerminal: 'base',
        defillama: 'Base',
        name: 'Base'
    },
    polygon: {
        geckoTerminal: 'polygon_pos',
        defillama: 'Polygon',
        name: 'Polygon'
    },
    solana: {
        geckoTerminal: 'solana',
        defillama: 'Solana',
        name: 'Solana'
    }
};

// Multi-network pool resolver
class PoolResolver {
    constructor() {
        this.geckoClient = new GeckoTerminalClient();
        this.defiLlamaClient = new DeFiLlamaClient();
    }

    async findPoolAcrossNetworks(token0Symbol, token1Symbol) {
        const results = [];
        
        for (const [networkKey, config] of Object.entries(NETWORK_CONFIG)) {
            try {
                // Search in DeFiLlama first (has more metadata)
                const defiLlamaPools = await this.defiLlamaClient.searchPoolsByTokens(token0Symbol, token1Symbol);
                const networkPools = defiLlamaPools.filter(pool => 
                    pool.chain.toLowerCase() === config.defillama.toLowerCase()
                );
                
                for (const pool of networkPools.slice(0, 3)) { // Top 3 per network
                    results.push({
                        network: networkKey,
                        networkName: config.name,
                        pool_address: pool.pool,
                        token_pair: pool.symbol,
                        tvl_usd: pool.tvlUsd,
                        apy: pool.apy,
                        protocol: pool.project,
                        source: 'defillama'
                    });
                }
                
            } catch (error) {
                console.error(`❌ Error searching ${config.name}:`, error.message);
                continue;
            }
        }
        
        return results.sort((a, b) => b.tvl_usd - a.tvl_usd);
    }

    async getPoolDetails(network, poolAddress) {
        try {
            const geckoNetwork = NETWORK_CONFIG[network]?.geckoTerminal;
            if (!geckoNetwork) {
                throw new Error(`Unsupported network: ${network}`);
            }
            
            const poolData = await this.geckoClient.getPoolData(geckoNetwork, poolAddress);
            return poolData;
            
        } catch (error) {
            console.error(`❌ Error getting pool details for ${poolAddress}:`, error.message);
            return null;
        }
    }
}

// Export clients
const geckoTerminalClient = new GeckoTerminalClient();
const defiLlamaClient = new DeFiLlamaClient();
const poolResolver = new PoolResolver();

module.exports = {
    GeckoTerminalClient,
    DeFiLlamaClient,
    PoolResolver,
    geckoTerminalClient,
    defiLlamaClient,
    poolResolver,
    NETWORK_CONFIG
};