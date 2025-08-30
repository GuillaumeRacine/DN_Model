#!/usr/bin/env node
// Comprehensive pool synchronization and metrics calculation
// Matches DeFiLlama pools with our database and calculates all metrics

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { defiLlamaClient } = require('../utils/api-client');
const { validateDataQuality } = require('../utils/math-helpers');
const axios = require('axios');

global.analyticsDB = analyticsDB;

class ComprehensivePoolSync {
    constructor() {
        this.processed = 0;
        this.successful = 0;
        this.delayBetweenRequests = 1000;
    }

    async run() {
        console.log('🔄 Comprehensive Pool Synchronization');
        console.log('📊 Matching DeFiLlama pools with analytics database\n');

        try {
            await analyticsDB.initialize();

            // Step 1: Get all DeFiLlama yield pools
            console.log('🎯 Step 1: Fetching all yield pools from DeFiLlama...');
            const defiLlamaPools = await this.fetchAllYieldPools();
            console.log(`✅ Found ${defiLlamaPools.length} pools from DeFiLlama\n`);

            // Step 2: Get existing pools from our database
            console.log('📂 Step 2: Loading existing analytics data...');
            const existingPools = await this.getExistingPools();
            console.log(`✅ Found ${existingPools.size} pools in analytics database\n`);

            // Step 3: Match and sync pools
            console.log('🔗 Step 3: Matching and syncing pools...');
            const matchResults = await this.matchAndSyncPools(defiLlamaPools, existingPools);
            
            // Step 4: Collect historical data for new pools
            console.log(`\n📈 Step 4: Collecting historical data for ${matchResults.newPools.length} new pools...`);
            await this.collectHistoricalForNewPools(matchResults.newPools);

            // Step 5: Calculate metrics for all pools
            console.log('\n🧮 Step 5: Calculating metrics for all pools...');
            await this.calculateMetricsForAllPools();

            // Summary
            console.log('\n📊 SYNCHRONIZATION COMPLETE:');
            console.log(`   Total DeFiLlama pools: ${defiLlamaPools.length}`);
            console.log(`   Matched existing pools: ${matchResults.matched}`);
            console.log(`   New pools added: ${matchResults.newPools.length}`);
            console.log(`   Metrics calculated: ${this.successful}`);

        } catch (error) {
            console.error('❌ Sync failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async fetchAllYieldPools() {
        try {
            const response = await axios.get('https://yields.llama.fi/pools');
            
            if (!response.data || !response.data.data) {
                throw new Error('Invalid response from DeFiLlama');
            }

            // Filter for significant pools
            return response.data.data.filter(pool => 
                pool.tvlUsd >= 100000 && // Min $100k TVL
                pool.apy > 0 && 
                pool.symbol &&
                pool.project &&
                pool.chain
            );

        } catch (error) {
            console.error('❌ Failed to fetch yield pools:', error.message);
            return [];
        }
    }

    async getExistingPools() {
        const pools = await analyticsDB.all(`
            SELECT 
                p.pool_address,
                p.token_pair,
                p.network,
                p.protocol,
                pa.fvr,
                pa.volatility_30d
            FROM pools p
            LEFT JOIN pool_analytics pa ON p.pool_address = pa.pool_address
        `);

        // Create a map for fast lookup with multiple key formats
        const poolMap = new Map();
        
        pools.forEach(pool => {
            // Create multiple lookup keys for better matching
            const cleanPair = this.normalizeTokenPair(pool.token_pair);
            const variants = this.generatePairVariants(cleanPair);
            
            variants.forEach(variant => {
                poolMap.set(variant.toLowerCase(), pool);
            });
        });

        return poolMap;
    }

    normalizeTokenPair(pair) {
        if (!pair) return '';
        
        // Enhanced normalization with more pattern matching
        let normalized = pair
            .replace(/\s*\d+(\.\d+)?%/g, '') // Remove percentages
            .replace(/\s*0\.\d+%/g, '')      // Remove specific fee patterns like 0.3%
            .replace(/\s*\(\d+(\.\d+)?%\)/g, '') // Remove (0.3%) patterns
            .replace(/\s*-\s*\d+(\.\d+)?%/g, '') // Remove - 0.3% patterns
            .replace(/\s+/g, '-') // Replace spaces with dash
            .replace(/[\/\\]/g, '-') // Replace slashes with dash
            .replace(/[()]/g, '') // Remove parentheses
            .replace(/[\[\]]/g, '') // Remove brackets
            .replace(/-+/g, '-') // Collapse multiple dashes
            .replace(/^-|-$/g, '') // Remove leading/trailing dashes
            .toUpperCase();

        // Handle specific token aliases
        const tokenAliases = {
            'WETH': ['ETH', 'WETH'],
            'ETH': ['WETH', 'ETH'],
            'WBTC': ['BTC', 'WBTC'],
            'BTC': ['WBTC', 'BTC'],
            'USDC': ['USDC.E', 'USDC'],
            'USDC.E': ['USDC', 'USDC.E'],
            'STETH': ['STETH', 'ST-ETH']
        };

        // Apply token aliases
        for (const [canonical, aliases] of Object.entries(tokenAliases)) {
            aliases.forEach(alias => {
                normalized = normalized.replace(new RegExp(`\\b${alias}\\b`, 'g'), canonical);
            });
        }
        
        return normalized;
    }

    generatePairVariants(pair) {
        const separators = ['-', '/', '_', ''];
        let tokens = [];
        
        // Try different separators to split
        for (const sep of ['-', '/', '_']) {
            if (pair.includes(sep)) {
                tokens = pair.split(sep);
                break;
            }
        }
        
        // If no separator found, try common token patterns
        if (tokens.length < 2) {
            const commonTokens = ['WETH', 'ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BTC', 'STETH', 'FRAX'];
            for (const token of commonTokens) {
                if (pair.includes(token) && pair.length > token.length) {
                    const remaining = pair.replace(token, '');
                    if (remaining.length > 0) {
                        tokens = [token, remaining];
                        break;
                    }
                }
            }
        }
        
        if (tokens.length !== 2) return [pair];
        
        const [token0, token1] = tokens.map(t => t.trim());
        const variants = [];
        
        // Generate all possible combinations with different separators
        for (const sep of separators) {
            variants.push(`${token0}${sep}${token1}`);
            variants.push(`${token1}${sep}${token0}`);
        }
        
        // Add original pair
        variants.push(pair);
        
        // Remove duplicates and empty strings
        return [...new Set(variants.filter(v => v.length > 0))];
    }

    async matchAndSyncPools(defiLlamaPools, existingPools) {
        const results = {
            matched: 0,
            newPools: [],
            updatedPools: []
        };

        // Debug: Show some existing pool keys for comparison
        const sampleExistingKeys = Array.from(existingPools.keys()).slice(0, 10);
        console.log(`   🔍 Sample existing pool keys: ${sampleExistingKeys.join(', ')}`);

        let debugCount = 0;
        for (const pool of defiLlamaPools) {
            const normalizedSymbol = this.normalizeTokenPair(pool.symbol);
            const variants = this.generatePairVariants(normalizedSymbol);
            
            // Debug first few pools
            if (debugCount < 5) {
                console.log(`   🔍 Pool: ${pool.symbol} → Normalized: ${normalizedSymbol}`);
                console.log(`      Variants: ${variants.slice(0, 5).join(', ')}...`);
                debugCount++;
            }
            
            let matched = false;
            for (const variant of variants) {
                const lowerVariant = variant.toLowerCase();
                if (existingPools.has(lowerVariant)) {
                    results.matched++;
                    matched = true;
                    
                    // Update TVL and APY data
                    const existingPool = existingPools.get(lowerVariant);
                    results.updatedPools.push({
                        ...existingPool,
                        currentTvl: pool.tvlUsd,
                        currentApy: pool.apy,
                        defiLlamaId: pool.pool
                    });
                    
                    if (debugCount <= 5) {
                        console.log(`      ✅ MATCHED on variant: ${variant}`);
                    }
                    break;
                }
            }

            if (!matched) {
                results.newPools.push(pool);
                if (debugCount <= 5) {
                    console.log(`      ❌ NO MATCH found`);
                }
            }
        }

        console.log(`   ✅ Matched ${results.matched} pools`);
        console.log(`   🆕 Found ${results.newPools.length} new pools`);

        // Show some examples of unmatched pools
        const sampleUnmatched = results.newPools.slice(0, 10).map(p => p.symbol);
        console.log(`   📋 Sample unmatched pools: ${sampleUnmatched.join(', ')}`);

        return results;
    }

    async collectHistoricalForNewPools(newPools) {
        const limit = Math.min(newPools.length, 50); // Process up to 50 new pools
        
        for (let i = 0; i < limit; i++) {
            const pool = newPools[i];
            this.processed++;
            
            console.log(`\n[${this.processed}/${limit}] ${pool.symbol} (${pool.chain})`);
            console.log(`   Project: ${pool.project} | TVL: $${(pool.tvlUsd/1e6).toFixed(1)}M`);
            
            try {
                // Save pool metadata
                await this.savePoolMetadata(pool);
                
                // Try to get historical data
                const historicalData = await this.getPoolHistoricalData(pool);
                
                if (historicalData && historicalData.length > 0) {
                    await this.saveHistoricalData(pool, historicalData);
                    this.successful++;
                    console.log(`   ✅ SUCCESS - ${historicalData.length} data points collected`);
                } else {
                    // Create synthetic data if no historical available
                    await this.createSyntheticData(pool);
                    console.log(`   ⚠️  Created synthetic data (no historical available)`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            // Rate limiting
            await this.delay(this.delayBetweenRequests);
        }
    }

    async savePoolMetadata(pool) {
        const tokens = this.extractTokensFromSymbol(pool.symbol);
        
        const poolData = {
            pool_address: pool.pool,
            network: pool.chain.toLowerCase(),
            token_pair: pool.symbol,
            token0_address: null,
            token1_address: null,
            token0_symbol: tokens[0] || null,
            token1_symbol: tokens[1] || null,
            fee_tier: null,
            protocol: pool.project
        };

        try {
            await analyticsDB.insertPool(poolData);
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint')) {
                throw error;
            }
        }
    }

    async getPoolHistoricalData(pool) {
        try {
            const url = `https://yields.llama.fi/chart/${pool.pool}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data && response.data.data) {
                return response.data.data;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    async saveHistoricalData(pool, historicalData) {
        let savedCount = 0;
        let previousPrice = null;

        for (const dataPoint of historicalData) {
            let timestamp, price, volume;
            
            if (dataPoint.timestamp) {
                timestamp = new Date(dataPoint.timestamp);
                price = dataPoint.apy || dataPoint.tvlUsd || 0;
                volume = dataPoint.volumeUsd1d || 0;
            } else {
                continue;
            }

            if (!timestamp || isNaN(timestamp.getTime())) continue;

            let logReturn = null;
            if (previousPrice !== null && previousPrice > 0 && price > 0) {
                logReturn = Math.log(price / previousPrice);
            }

            try {
                await analyticsDB.insertPriceData({
                    timestamp: timestamp.toISOString(),
                    pool_address: pool.pool,
                    network: pool.chain.toLowerCase(),
                    price: price,
                    volume_usd: volume,
                    log_return: logReturn
                });
                savedCount++;
            } catch (error) {
                // Skip duplicates
            }

            previousPrice = price;
        }

        return savedCount;
    }

    async createSyntheticData(pool) {
        // Create minimal synthetic data for new pools
        const now = new Date();
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            
            try {
                await analyticsDB.insertPriceData({
                    timestamp: date.toISOString(),
                    pool_address: pool.pool,
                    network: pool.chain.toLowerCase(),
                    price: pool.apy || 100,
                    volume_usd: pool.volumeUsd1d || 0,
                    log_return: null
                });
            } catch (error) {
                // Skip duplicates
            }
        }
    }

    async calculateMetricsForAllPools() {
        // Get pools that need metrics calculation
        const pools = await analyticsDB.all(`
            SELECT 
                p.pool_address,
                p.network,
                p.token_pair,
                COUNT(pd.id) as data_points
            FROM pools p
            LEFT JOIN price_data pd ON p.pool_address = pd.pool_address
            LEFT JOIN pool_analytics pa ON p.pool_address = pa.pool_address
            WHERE pd.id IS NOT NULL
            AND (pa.fvr IS NULL OR pa.last_updated < datetime('now', '-1 day'))
            GROUP BY p.pool_address
            HAVING COUNT(pd.id) >= 7
            LIMIT 100
        `);

        console.log(`   Found ${pools.length} pools needing metric calculation`);

        for (const pool of pools) {
            await this.calculatePoolMetrics(pool);
        }
    }

    async calculatePoolMetrics(pool) {
        try {
            // Get price data
            const priceData = await analyticsDB.all(`
                SELECT timestamp, price, volume_usd, log_return
                FROM price_data
                WHERE pool_address = ?
                ORDER BY timestamp ASC
                LIMIT 365
            `, [pool.pool_address]);

            if (priceData.length < 7) return;

            // Calculate volatility
            const returns = priceData
                .filter(d => d.log_return !== null)
                .map(d => d.log_return);
            
            const volatility30d = this.calculateVolatility(returns, 30);
            
            // Estimate APY and FVR
            const avgVolume = priceData.reduce((sum, d) => sum + (d.volume_usd || 0), 0) / priceData.length;
            const estimatedTvl = avgVolume * 50; // Rough estimate
            const estimatedApy = estimatedTvl > 0 ? (avgVolume * 0.003 * 365) / estimatedTvl : 0;
            
            const fvr = volatility30d > 0 ? estimatedApy / volatility30d : null;
            const ilRiskScore = this.calculateILRiskScore(volatility30d);
            const recommendation = this.getRecommendation(fvr);

            // Save metrics
            await analyticsDB.run(`
                INSERT OR REPLACE INTO pool_analytics (
                    pool_address, network, token_pair, tvl_usd, volume_24h,
                    apy_base, volatility_30d, fvr, il_risk_score, recommendation,
                    data_points_count, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                pool.pool_address, pool.network, pool.token_pair,
                estimatedTvl, avgVolume, estimatedApy,
                volatility30d, fvr, ilRiskScore, recommendation,
                priceData.length
            ]);

            this.successful++;

        } catch (error) {
            console.error(`   ❌ Metrics calculation failed for ${pool.token_pair}:`, error.message);
        }
    }

    calculateVolatility(returns, days) {
        if (returns.length < days) return null;
        
        const recentReturns = returns.slice(-days);
        const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
        const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
        
        return Math.sqrt(variance) * Math.sqrt(365); // Annualized
    }

    calculateILRiskScore(volatility) {
        if (!volatility) return null;
        
        if (volatility < 0.2) return 1;
        if (volatility < 0.4) return 3;
        if (volatility < 0.6) return 5;
        if (volatility < 0.8) return 7;
        if (volatility < 1.0) return 9;
        return 10;
    }

    getRecommendation(fvr) {
        if (!fvr) return 'insufficient_data';
        if (fvr >= 1.0) return 'attractive';
        if (fvr >= 0.6) return 'fair';
        return 'overpriced';
    }

    extractTokensFromSymbol(symbol) {
        if (!symbol) return [null, null];
        
        const separators = ['-', '/', '_'];
        for (const sep of separators) {
            if (symbol.includes(sep)) {
                const tokens = symbol.split(sep);
                return [tokens[0], tokens[1]];
            }
        }
        
        // Try common patterns
        const patterns = ['WETH', 'ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BTC'];
        for (const pattern of patterns) {
            if (symbol.includes(pattern)) {
                const other = symbol.replace(pattern, '');
                if (other && other !== symbol) {
                    return [pattern, other];
                }
            }
        }
        
        return [symbol, null];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the sync
async function main() {
    const sync = new ComprehensivePoolSync();
    await sync.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComprehensivePoolSync;