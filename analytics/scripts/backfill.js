#!/usr/bin/env node
// Historical data backfill script for CLM Analytics
// Collects 6 months of hourly OHLC data from GeckoTerminal

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { geckoTerminalClient, defiLlamaClient } = require('../utils/api-client');
const { calculateLogReturns, validateDataQuality } = require('../utils/math-helpers');

// Make database globally available for API clients
global.analyticsDB = analyticsDB;

class HistoricalDataBackfill {
    constructor() {
        this.batchSize = 10; // Process pools in batches to avoid overwhelming APIs
        this.delayBetweenPools = 3000; // 3 second delay between pools
        this.maxRetries = 3;
    }

    async run(options = {}) {
        const {
            days = 180,           // 6 months default
            minTVL = 1000000,     // $1M minimum TVL
            maxPools = 50,        // Limit for initial run
            networks = ['eth', 'arbitrum', 'base']    // Multi-chain approach
        } = options;

        console.log('🔄 Historical Data Backfill Starting...');
        console.log(`📊 Target: ${days} days of data for top ${maxPools} pools`);
        console.log(`💰 Min TVL: $${minTVL.toLocaleString()}`);
        console.log(`🌐 Networks: ${networks.join(', ')}\n`);

        try {
            await analyticsDB.initialize();

            // Step 1: Get top pools from DeFiLlama
            console.log('🔍 Step 1: Finding top pools...');
            const topPools = await this.getTopPools(networks, minTVL, maxPools);
            console.log(`✅ Found ${topPools.length} pools to process\n`);

            if (topPools.length === 0) {
                console.log('❌ No pools found matching criteria');
                return;
            }

            // Step 2: Process pools in batches
            console.log('📥 Step 2: Collecting historical data...');
            let processed = 0;
            let successful = 0;
            
            for (let i = 0; i < topPools.length; i += this.batchSize) {
                const batch = topPools.slice(i, i + this.batchSize);
                
                console.log(`\n🔄 Processing batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(topPools.length/this.batchSize)}:`);
                
                for (const pool of batch) {
                    processed++;
                    console.log(`\n[${processed}/${topPools.length}] ${pool.token_pair} (${pool.protocol})`);
                    console.log(`   TVL: $${pool.tvl_usd.toLocaleString()}, APY: ${pool.apy?.toFixed(2) || 'N/A'}%`);
                    
                    try {
                        const success = await this.processPool(pool, days);
                        if (success) {
                            successful++;
                            console.log(`   ✅ Success - ${success.dataPoints} data points collected`);
                        } else {
                            console.log(`   ❌ Failed - no data collected`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Error: ${error.message}`);
                    }
                    
                    // Delay between pools to be respectful to APIs
                    if (i < topPools.length - 1) {
                        await this.delay(this.delayBetweenPools);
                    }
                }
            }

            console.log(`\n📊 Backfill Complete:`);
            console.log(`   Processed: ${processed} pools`);
            console.log(`   Successful: ${successful} pools`);
            console.log(`   Success rate: ${((successful/processed)*100).toFixed(1)}%`);

            // Step 3: Show summary statistics
            await this.showSummary();

        } catch (error) {
            console.error('❌ Backfill failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async getTopPools(networks, minTVL, maxPools) {
        // Get real pools from GeckoTerminal API
        const allPools = [];
        
        for (const network of networks) {
            try {
                console.log(`   Fetching ${network} pools from GeckoTerminal...`);
                
                // GeckoTerminal provides top pools directly
                const response = await geckoTerminalClient.getTopPools(network, Math.min(maxPools, 100));
                
                if (response?.data) {
                    const formattedPools = response.data
                        .filter(pool => {
                            // Parse TVL from attributes
                            const tvl = parseFloat(pool.attributes?.reserve_in_usd || 0);
                            return tvl >= minTVL;
                        })
                        .map(pool => {
                            const attrs = pool.attributes;
                            return {
                                pool_address: attrs.address,
                                network: network,
                                token_pair: attrs.name || `${attrs.base_token_symbol}/${attrs.quote_token_symbol}`,
                                tvl_usd: parseFloat(attrs.reserve_in_usd || 0),
                                apy: parseFloat(attrs.pool_fee_apy || 0) * 100, // Convert to percentage
                                protocol: pool.relationships?.dex?.data?.id || 'unknown',
                                underlying_tokens: [
                                    attrs.base_token_address,
                                    attrs.quote_token_address
                                ],
                                source: 'geckoterminal'
                            };
                        })
                        .sort((a, b) => b.tvl_usd - a.tvl_usd)
                        .slice(0, maxPools);
                    
                    allPools.push(...formattedPools);
                    console.log(`   ✅ ${network}: ${formattedPools.length} pools found`);
                } else {
                    console.log(`   ⚠️  No pools data from GeckoTerminal for ${network}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Error fetching ${network} pools:`, error.message);
                
                // Fallback to known pools if API fails
                if (network === 'eth' && allPools.length === 0) {
                    console.log(`   Using fallback pools for testing...`);
                    const fallbackPools = [
                        {
                            pool_address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
                            network: 'eth',
                            token_pair: 'USDC-ETH',
                            tvl_usd: 45000000,
                            apy: 18.5,
                            protocol: 'uniswap-v3',
                            underlying_tokens: ['0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
                            source: 'fallback'
                        }
                    ];
                    allPools.push(...fallbackPools);
                }
            }
        }
        
        return allPools.slice(0, maxPools);
    }

    async processPool(pool, days) {
        let retries = 0;
        
        while (retries < this.maxRetries) {
            try {
                // Step 1: Save pool metadata
                await this.savePoolMetadata(pool);

                // Step 2: Get historical OHLCV data from GeckoTerminal
                console.log(`     Fetching ${days} days of OHLCV data...`);
                
                const ohlcvData = await geckoTerminalClient.getHistoricalOHLCV(
                    pool.network, 
                    pool.pool_address, 
                    days
                );

                if (!ohlcvData || ohlcvData.length === 0) {
                    console.log(`     ⚠️  No OHLCV data available from GeckoTerminal`);
                    return null;
                }

                // Step 3: Process and store price data
                console.log(`     Processing ${ohlcvData.length} data points...`);
                
                const priceData = this.processOHLCVData(ohlcvData, pool);
                const validation = validateDataQuality(priceData.map(p => p.price), 'prices');
                
                if (!validation.valid) {
                    console.log(`     ⚠️  Data quality issue: ${validation.error}`);
                    return null;
                }

                // Step 4: Store in database
                let storedCount = 0;
                for (const data of priceData) {
                    try {
                        await analyticsDB.insertPriceData(data);
                        storedCount++;
                    } catch (error) {
                        if (!error.message.includes('UNIQUE constraint')) {
                            console.log(`     ⚠️  Insert error: ${error.message}`);
                        }
                    }
                }

                return {
                    dataPoints: storedCount,
                    totalPoints: ohlcvData.length,
                    oldestData: new Date(ohlcvData[0][0] * 1000),
                    newestData: new Date(ohlcvData[ohlcvData.length - 1][0] * 1000)
                };

            } catch (error) {
                retries++;
                console.log(`     ⚠️  Attempt ${retries}/${this.maxRetries} failed: ${error.message}`);
                
                if (retries < this.maxRetries) {
                    await this.delay(2000 * retries); // Exponential backoff
                } else {
                    throw error;
                }
            }
        }
    }

    processOHLCVData(ohlcvData, pool) {
        // Convert OHLCV candles to price data with log returns
        // Format: [timestamp, open, high, low, close, volume]
        
        const priceData = [];
        let previousClose = null;

        for (const candle of ohlcvData) {
            const [timestamp, open, high, low, close, volume] = candle;
            
            if (close <= 0) continue; // Skip invalid prices
            
            let logReturn = null;
            if (previousClose !== null && previousClose > 0) {
                logReturn = Math.log(close / previousClose);
            }

            priceData.push({
                timestamp: new Date(timestamp * 1000).toISOString(),
                pool_address: pool.pool_address,
                network: pool.network,
                price: close,
                volume_usd: volume || 0,
                log_return: logReturn
            });

            previousClose = close;
        }

        return priceData;
    }

    async savePoolMetadata(pool) {
        const poolData = {
            pool_address: pool.pool_address,
            network: pool.network,
            token_pair: pool.token_pair,
            token0_address: pool.underlying_tokens?.[0] || null,
            token1_address: pool.underlying_tokens?.[1] || null,
            token0_symbol: this.extractTokenSymbol(pool.token_pair, 0),
            token1_symbol: this.extractTokenSymbol(pool.token_pair, 1),
            fee_tier: null, // Will be filled by GeckoTerminal data later
            protocol: pool.protocol
        };

        try {
            await analyticsDB.insertPool(poolData);
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint')) {
                throw error;
            }
        }
    }

    extractTokenSymbol(tokenPair, index) {
        if (!tokenPair) return null;
        
        // Try common patterns: "ETH-USDC", "ETH/USDC", "ETHUSDC"
        let tokens = [];
        
        if (tokenPair.includes('-')) {
            tokens = tokenPair.split('-');
        } else if (tokenPair.includes('/')) {
            tokens = tokenPair.split('/');
        } else {
            // For patterns like "ETHUSDC", this is harder to parse reliably
            return null;
        }
        
        return tokens[index]?.trim() || null;
    }

    async showSummary() {
        console.log('\n📊 Database Summary:');
        
        const counts = await analyticsDB.getTableCounts();
        console.log(`   Pools: ${counts.pools}`);
        console.log(`   Price data points: ${counts.price_data.toLocaleString()}`);
        
        // Show data coverage
        const coverage = await analyticsDB.all(`
            SELECT 
                p.network,
                COUNT(*) as pools,
                MIN(p.timestamp) as oldest_data,
                MAX(p.timestamp) as newest_data,
                COUNT(CASE WHEN p.log_return IS NOT NULL THEN 1 END) as returns_count
            FROM price_data p
            JOIN pools pl ON p.pool_address = pl.pool_address
            GROUP BY p.network
        `);
        
        console.log('\n📅 Data Coverage:');
        for (const row of coverage) {
            const oldestDate = new Date(row.oldest_data);
            const newestDate = new Date(row.newest_data);
            const daysCovered = (newestDate - oldestDate) / (1000 * 60 * 60 * 24);
            
            console.log(`   ${row.network.toUpperCase()}:`);
            console.log(`     Pools: ${row.pools}`);
            console.log(`     Data range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}`);
            console.log(`     Coverage: ${Math.round(daysCovered)} days`);
            console.log(`     Returns: ${row.returns_count.toLocaleString()}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        
        if (key === 'days') options.days = parseInt(value);
        else if (key === 'pools') options.maxPools = parseInt(value);
        else if (key === 'tvl') options.minTVL = parseFloat(value);
        else if (key === 'networks') options.networks = value.split(',');
    }
    
    console.log('🚀 CLM Analytics - Historical Data Backfill\n');
    
    if (args.includes('--help')) {
        console.log('Usage: node backfill.js [options]');
        console.log('Options:');
        console.log('  --days 180        Number of days to collect (default: 180)');
        console.log('  --pools 50        Maximum pools to process (default: 50)');
        console.log('  --tvl 1000000     Minimum TVL in USD (default: 1000000)');
        console.log('  --networks eth    Comma-separated networks (default: eth)');
        console.log('\nExample:');
        console.log('  node backfill.js --days 90 --pools 20 --networks eth,arbitrum');
        return;
    }
    
    const backfill = new HistoricalDataBackfill();
    await backfill.run(options);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = HistoricalDataBackfill;