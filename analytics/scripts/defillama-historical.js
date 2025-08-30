#!/usr/bin/env node
// DeFiLlama historical data collection for CLM analytics
// Uses DeFiLlama's historical pool data endpoints

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { defiLlamaClient } = require('../utils/api-client');
const { validateDataQuality } = require('../utils/math-helpers');
const axios = require('axios');

global.analyticsDB = analyticsDB;

class DeFiLlamaHistorical {
    constructor() {
        this.delayBetweenRequests = 1000; // 1 second delay
        this.maxRetries = 3;
        
        // DeFiLlama Pro API key from .env
        this.apiKey = process.env.DEFILLAMA_API_KEY;
        
        // Base URLs for different DeFiLlama endpoints
        this.baseURL = 'https://yields.llama.fi';
        this.coinsURL = 'https://coins.llama.fi';
        this.proURL = 'https://api.llama.fi'; // Pro endpoints
    }

    async run() {
        console.log('🦙 DeFiLlama Historical Data Collection for CLM Analytics');
        console.log(`🔑 Using API Key: ${this.apiKey ? 'Present' : 'Missing'}\n`);

        try {
            await analyticsDB.initialize();

            // Step 1: Get all current pool data from DeFiLlama
            console.log('📊 Step 1: Fetching current pool data from DeFiLlama...');
            const currentPools = await this.getCurrentPools();
            console.log(`✅ Found ${currentPools.length} pools with current data\n`);

            // Step 2: Filter for high-yield pools (similar to top 100 yield pools)
            console.log('🎯 Step 2: Filtering for high-yield pools...');
            const highYieldPools = this.filterHighYieldPools(currentPools);
            console.log(`✅ Identified ${highYieldPools.length} high-yield pools\n`);

            // Step 3: Collect historical data for each pool
            console.log('📈 Step 3: Collecting historical data...');
            await this.collectHistoricalData(highYieldPools);

            console.log('\n🎉 DeFiLlama historical collection completed!');

        } catch (error) {
            console.error('❌ DeFiLlama collection failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async getCurrentPools() {
        try {
            // Get all pools from DeFiLlama yields endpoint
            console.log('   Fetching from yields.llama.fi/pools...');
            const response = await axios.get(`${this.baseURL}/pools`);
            
            if (!response.data || !response.data.data) {
                throw new Error('No pool data received from DeFiLlama');
            }

            return response.data.data.filter(pool => {
                // Filter for pools we can use
                return pool.pool && 
                       pool.tvlUsd > 100000 && // Min $100k TVL
                       pool.apy > 5 && // Min 5% APY
                       pool.symbol && 
                       pool.chain;
            });

        } catch (error) {
            console.error('   ❌ Error fetching current pools:', error.message);
            return [];
        }
    }

    filterHighYieldPools(pools) {
        return pools
            .filter(pool => {
                // Focus on high-yield pools that match our target list
                const apy = pool.apy || 0;
                const tvl = pool.tvlUsd || 0;
                
                // High-yield criteria
                return apy >= 20 && // Min 20% APY
                       tvl >= 500000 && // Min $500k TVL
                       pool.symbol && 
                       pool.chain &&
                       pool.pool;
            })
            .sort((a, b) => (b.apy || 0) - (a.apy || 0)) // Sort by APY descending
            .slice(0, 100); // Top 100 by APY
    }

    async collectHistoricalData(pools) {
        let processed = 0;
        let successful = 0;

        for (const pool of pools) {
            processed++;
            
            console.log(`\n[${processed}/${pools.length}] ${pool.symbol} (${pool.chain})`);
            console.log(`   Pool ID: ${pool.pool}`);
            console.log(`   Current APY: ${pool.apy?.toFixed(2)}%`);
            console.log(`   TVL: $${pool.tvlUsd?.toLocaleString()}`);

            try {
                // Method 1: Try pool-specific historical data
                let historicalData = await this.getPoolHistoricalData(pool);
                
                if (!historicalData || historicalData.length === 0) {
                    // Method 2: Try token price historical data
                    historicalData = await this.getTokenPriceHistoricalData(pool);
                }

                if (historicalData && historicalData.length > 0) {
                    const result = await this.processAndStoreData(pool, historicalData);
                    if (result.success) {
                        successful++;
                        console.log(`   ✅ SUCCESS - ${result.dataPoints} data points (${result.daysCovered} days)`);
                    } else {
                        console.log(`   ⚠️  PARTIAL - ${result.error}`);
                    }
                } else {
                    console.log(`   ❌ No historical data available`);
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }

            // Rate limiting delay
            await this.delay(this.delayBetweenRequests);
        }

        console.log(`\n📊 DeFiLlama Historical Results:`);
        console.log(`   Processed: ${processed} pools`);
        console.log(`   Successful: ${successful} pools`);
        console.log(`   Success rate: ${((successful/processed)*100).toFixed(1)}%`);
    }

    async getPoolHistoricalData(pool) {
        try {
            // Try DeFiLlama Pro historical pool endpoint
            if (this.apiKey) {
                console.log(`     📊 Trying Pro API historical data...`);
                
                const url = `${this.baseURL}/chart/${pool.pool}`;
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });

                if (response.data && response.data.data) {
                    return response.data.data;
                }
            }

            // Fallback: Try public historical endpoint
            console.log(`     📊 Trying public historical data...`);
            const publicURL = `${this.baseURL}/chart/${pool.pool}`;
            const response = await axios.get(publicURL);
            
            if (response.data && response.data.data) {
                return response.data.data;
            }

            return null;

        } catch (error) {
            console.log(`     ⚠️  Pool historical data failed: ${error.message}`);
            return null;
        }
    }

    async getTokenPriceHistoricalData(pool) {
        try {
            // Extract token symbols from pool symbol
            const tokens = this.extractTokensFromSymbol(pool.symbol);
            
            if (!tokens || tokens.length < 2) {
                return null;
            }

            console.log(`     💰 Fetching token price history for ${tokens.join('/')}...`);

            // Get historical prices for both tokens
            const token0History = await this.getTokenPriceHistory(tokens[0], pool.chain);
            const token1History = await this.getTokenPriceHistory(tokens[1], pool.chain);

            if (token0History && token1History) {
                // Calculate pool price ratio from token prices
                return this.calculatePoolPriceFromTokens(token0History, token1History);
            }

            return null;

        } catch (error) {
            console.log(`     ⚠️  Token price history failed: ${error.message}`);
            return null;
        }
    }

    async getTokenPriceHistory(tokenSymbol, chain) {
        try {
            // Use CoinGecko-style API for historical prices
            const days = 180; // 6 months
            const url = `${this.coinsURL}/prices/historical/${days}/${chain}:${tokenSymbol}`;
            
            const response = await axios.get(url, {
                timeout: 10000
            });

            if (response.data && response.data.prices) {
                return response.data.prices.map(([timestamp, price]) => ({
                    timestamp: timestamp,
                    price: price
                }));
            }

            return null;

        } catch (error) {
            // console.log(`     Token ${tokenSymbol} history failed: ${error.message}`);
            return null;
        }
    }

    calculatePoolPriceFromTokens(token0History, token1History) {
        const poolHistory = [];
        
        // Align timestamps and calculate price ratios
        for (const t0Point of token0History) {
            const t1Point = token1History.find(t1 => 
                Math.abs(t1.timestamp - t0Point.timestamp) < 3600000 // Within 1 hour
            );
            
            if (t1Point && t0Point.price > 0 && t1Point.price > 0) {
                poolHistory.push({
                    timestamp: t0Point.timestamp,
                    price: t0Point.price / t1Point.price, // token0/token1 ratio
                    token0_price: t0Point.price,
                    token1_price: t1Point.price
                });
            }
        }

        return poolHistory;
    }

    extractTokensFromSymbol(symbol) {
        if (!symbol) return null;

        // Try different separators
        let tokens = [];
        
        if (symbol.includes('-')) {
            tokens = symbol.split('-');
        } else if (symbol.includes('/')) {
            tokens = symbol.split('/');
        } else if (symbol.includes('_')) {
            tokens = symbol.split('_');
        } else {
            // Try to parse common patterns like "ETHUSDC"
            const commonTokens = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BTC'];
            for (const token of commonTokens) {
                if (symbol.startsWith(token)) {
                    tokens = [token, symbol.substring(token.length)];
                    break;
                }
            }
        }

        return tokens.length >= 2 ? tokens.slice(0, 2) : null;
    }

    async processAndStoreData(pool, historicalData) {
        try {
            if (!historicalData || historicalData.length === 0) {
                return { success: false, error: 'No historical data' };
            }

            // Save pool metadata
            await this.savePoolMetadata(pool);

            // Convert to our price data format
            const priceData = this.convertToOurFormat(pool, historicalData);
            
            if (priceData.length === 0) {
                return { success: false, error: 'No valid price data after conversion' };
            }

            // Validate data quality
            const validation = validateDataQuality(priceData.map(p => p.price), 'prices');
            if (!validation.valid) {
                return { success: false, error: `Data quality issue: ${validation.error}` };
            }

            // Store in database
            let storedCount = 0;
            let duplicatesSkipped = 0;

            for (const data of priceData) {
                try {
                    await analyticsDB.insertPriceData(data);
                    storedCount++;
                } catch (error) {
                    if (error.message.includes('UNIQUE constraint')) {
                        duplicatesSkipped++;
                    } else {
                        console.log(`     ⚠️  Insert error: ${error.message}`);
                    }
                }
            }

            // Calculate coverage
            const timestamps = priceData.map(d => new Date(d.timestamp).getTime());
            const daysCovered = (Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000);

            return {
                success: true,
                dataPoints: storedCount,
                daysCovered: Math.round(daysCovered),
                duplicatesSkipped: duplicatesSkipped
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    convertToOurFormat(pool, historicalData) {
        const priceData = [];
        let previousPrice = null;

        for (const dataPoint of historicalData) {
            let timestamp, price;
            
            // Handle different DeFiLlama data formats
            if (dataPoint.timestamp && dataPoint.price) {
                timestamp = new Date(dataPoint.timestamp);
                price = dataPoint.price;
            } else if (dataPoint.date && dataPoint.tvlUsd) {
                timestamp = new Date(dataPoint.date);
                price = dataPoint.apy || dataPoint.tvlUsd; // Use APY as proxy for "price"
            } else if (Array.isArray(dataPoint) && dataPoint.length >= 2) {
                timestamp = new Date(dataPoint[0] * 1000);
                price = dataPoint[1];
            } else {
                continue;
            }

            if (price <= 0 || !timestamp || isNaN(timestamp.getTime())) {
                continue;
            }

            // Calculate log return
            let logReturn = null;
            if (previousPrice !== null && previousPrice > 0) {
                logReturn = Math.log(price / previousPrice);
            }

            priceData.push({
                timestamp: timestamp.toISOString(),
                pool_address: pool.pool || pool.id || `defillama-${pool.symbol}`,
                network: pool.chain || 'ethereum',
                price: price,
                volume_usd: pool.volumeUsd1d || 0,
                log_return: logReturn
            });

            previousPrice = price;
        }

        return priceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    async savePoolMetadata(pool) {
        const poolData = {
            pool_address: pool.pool || pool.id || `defillama-${pool.symbol}`,
            network: pool.chain || 'ethereum',
            token_pair: pool.symbol,
            token0_address: null,
            token1_address: null,
            token0_symbol: null,
            token1_symbol: null,
            fee_tier: null,
            protocol: pool.project || 'defillama'
        };

        try {
            await analyticsDB.insertPool(poolData);
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint')) {
                throw error;
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Command line interface
async function main() {
    const collector = new DeFiLlamaHistorical();
    await collector.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DeFiLlamaHistorical;