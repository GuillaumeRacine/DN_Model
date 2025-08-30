#!/usr/bin/env node
// Comprehensive 180-day historical backfill for top 100 yield pools
// Targets pools from the top yield list to ensure complete analytics coverage

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { geckoTerminalClient, defiLlamaClient } = require('../utils/api-client');
const { calculateLogReturns, validateDataQuality } = require('../utils/math-helpers');

// Make database globally available for API clients
global.analyticsDB = analyticsDB;

class ComprehensiveBackfill {
    constructor() {
        this.batchSize = 5; // Smaller batches to avoid rate limiting
        this.delayBetweenPools = 5000; // 5 second delay between pools
        this.maxRetries = 3;
        this.targetDays = 180; // 6 months minimum
    }

    async run(options = {}) {
        const {
            days = 180,           // 6 months historical data
            networks = ['eth', 'arbitrum', 'base', 'polygon']
        } = options;

        console.log('🔄 Comprehensive Historical Backfill Starting...');
        console.log(`📊 Target: ${days} days of data for top yield pools`);
        console.log(`🌐 Networks: ${networks.join(', ')}\n`);

        try {
            await analyticsDB.initialize();

            // Step 1: Get priority pools from multiple networks
            console.log('🔍 Step 1: Discovering high-yield pools across networks...');
            const allPools = await this.getTopYieldPools(networks);
            console.log(`✅ Found ${allPools.length} priority pools to process\n`);

            if (allPools.length === 0) {
                console.log('❌ No pools found matching criteria');
                return;
            }

            // Step 2: Process pools in batches with 180+ days target
            console.log('📥 Step 2: Collecting 180+ days historical data...');
            let processed = 0;
            let successful = 0;
            
            for (let i = 0; i < allPools.length; i += this.batchSize) {
                const batch = allPools.slice(i, i + this.batchSize);
                
                console.log(`\n🔄 Processing batch ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(allPools.length/this.batchSize)}:`);
                
                for (const pool of batch) {
                    processed++;
                    console.log(`\n[${processed}/${allPools.length}] ${pool.token_pair} (${pool.protocol})`);
                    console.log(`   Network: ${pool.network}, TVL: $${pool.tvl_usd?.toLocaleString() || 'N/A'}`);
                    
                    try {
                        const success = await this.processPoolFor180Days(pool, days);
                        if (success) {
                            successful++;
                            console.log(`   ✅ Success - ${success.dataPoints} data points collected (${success.daysCovered} days)`);
                        } else {
                            console.log(`   ❌ Failed - insufficient historical data available`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Error: ${error.message}`);
                    }
                    
                    // Delay between pools to respect API limits
                    if (processed < allPools.length) {
                        console.log(`   ⏳ Waiting ${this.delayBetweenPools/1000}s before next pool...`);
                        await this.delay(this.delayBetweenPools);
                    }
                }
            }

            console.log(`\n📊 Comprehensive Backfill Complete:`);
            console.log(`   Processed: ${processed} pools`);
            console.log(`   Successful: ${successful} pools`);
            console.log(`   Success rate: ${((successful/processed)*100).toFixed(1)}%`);

            // Step 3: Show final coverage summary
            await this.showCoverageSummary();

        } catch (error) {
            console.error('❌ Comprehensive backfill failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async getTopYieldPools(networks) {
        const allPools = [];
        
        for (const network of networks) {
            try {
                console.log(`   Fetching ${network} high-yield pools...`);
                
                // Get top pools sorted by volume/activity (proxy for yield)
                let limit = 100;
                if (network === 'eth') limit = 200; // More Ethereum pools
                
                const response = await geckoTerminalClient.getTopPools(network, limit);
                
                if (response?.data) {
                    // Filter for pools likely to be in our top 100 yield list
                    const formattedPools = response.data
                        .filter(pool => {
                            const attrs = pool.attributes;
                            const tvl = parseFloat(attrs?.reserve_in_usd || 0);
                            const volume24h = parseFloat(attrs?.volume_usd?.h24 || 0);
                            
                            // Focus on pools with decent TVL and high volume activity
                            return tvl >= 100000 && volume24h >= 10000; // $100K TVL, $10K daily volume
                        })
                        .map(pool => {
                            const attrs = pool.attributes;
                            return {
                                pool_address: attrs.address,
                                network: network,
                                token_pair: attrs.name || `${attrs.base_token_symbol}/${attrs.quote_token_symbol}`,
                                tvl_usd: parseFloat(attrs.reserve_in_usd || 0),
                                volume_24h: parseFloat(attrs.volume_usd?.h24 || 0),
                                protocol: pool.relationships?.dex?.data?.id || 'unknown',
                                underlying_tokens: [
                                    attrs.base_token_address,
                                    attrs.quote_token_address
                                ],
                                source: 'geckoterminal'
                            };
                        })
                        // Sort by volume activity (proxy for yield)
                        .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
                        .slice(0, Math.min(50, limit)); // Top 50 per network
                    
                    allPools.push(...formattedPools);
                    console.log(`   ✅ ${network}: ${formattedPools.length} high-activity pools found`);
                } else {
                    console.log(`   ⚠️  No pool data from GeckoTerminal for ${network}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Error fetching ${network} pools:`, error.message);
            }
        }
        
        // Remove duplicates and return top pools by activity
        const uniquePools = allPools.reduce((acc, pool) => {
            const key = `${pool.network}-${pool.pool_address}`;
            if (!acc.has(key)) {
                acc.set(key, pool);
            }
            return acc;
        }, new Map());
        
        return Array.from(uniquePools.values())
            .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
            .slice(0, 100); // Top 100 overall
    }

    async processPoolFor180Days(pool, targetDays) {
        let retries = 0;
        
        while (retries < this.maxRetries) {
            try {
                // Step 1: Check existing data coverage
                const existingCoverage = await analyticsDB.get(`
                    SELECT 
                        COUNT(*) as data_points,
                        MIN(DATE(timestamp)) as oldest_date,
                        MAX(DATE(timestamp)) as newest_date,
                        JULIANDAY(MAX(timestamp)) - JULIANDAY(MIN(timestamp)) as days_covered
                    FROM price_data
                    WHERE pool_address = ?
                `, [pool.pool_address]);

                if (existingCoverage && existingCoverage.days_covered >= targetDays) {
                    console.log(`     ✅ Pool already has ${Math.round(existingCoverage.days_covered)} days of data`);
                    return {
                        dataPoints: existingCoverage.data_points,
                        daysCovered: existingCoverage.days_covered,
                        status: 'sufficient_data'
                    };
                }

                // Step 2: Save pool metadata first
                await this.savePoolMetadata(pool);

                // Step 3: Collect 180+ days of historical data
                console.log(`     Fetching ${targetDays} days of historical data...`);
                
                const ohlcvData = await geckoTerminalClient.getHistoricalOHLCV(
                    pool.network, 
                    pool.pool_address, 
                    targetDays
                );

                if (!ohlcvData || ohlcvData.length === 0) {
                    console.log(`     ⚠️  No historical OHLCV data available from GeckoTerminal`);
                    retries++;
                    if (retries < this.maxRetries) {
                        await this.delay(2000 * retries);
                        continue;
                    }
                    return null;
                }

                // Validate we have sufficient coverage
                if (ohlcvData.length < targetDays * 24 * 0.5) { // At least 50% hourly coverage
                    console.log(`     ⚠️  Insufficient data: only ${ohlcvData.length} data points for ${targetDays} days`);
                    return null;
                }

                // Step 4: Process and validate price data
                console.log(`     Processing ${ohlcvData.length} data points...`);
                
                const priceData = this.processOHLCVData(ohlcvData, pool);
                const validation = validateDataQuality(priceData.map(p => p.price), 'prices');
                
                if (!validation.valid) {
                    console.log(`     ⚠️  Data quality issue: ${validation.error}`);
                    return null;
                }

                // Step 5: Store in database (handle duplicates gracefully)
                let storedCount = 0;
                let duplicates = 0;
                
                for (const data of priceData) {
                    try {
                        await analyticsDB.insertPriceData(data);
                        storedCount++;
                    } catch (error) {
                        if (error.message.includes('UNIQUE constraint')) {
                            duplicates++;
                        } else {
                            console.log(`     ⚠️  Insert error: ${error.message}`);
                        }
                    }
                }

                if (duplicates > 0) {
                    console.log(`     ℹ️  Skipped ${duplicates} duplicate entries`);
                }

                // Calculate actual days covered
                const oldestTimestamp = Math.min(...ohlcvData.map(d => d[0]));
                const newestTimestamp = Math.max(...ohlcvData.map(d => d[0]));
                const daysCovered = (newestTimestamp - oldestTimestamp) / (24 * 60 * 60);

                return {
                    dataPoints: storedCount,
                    totalPoints: ohlcvData.length,
                    daysCovered: daysCovered,
                    oldestData: new Date(oldestTimestamp * 1000),
                    newestData: new Date(newestTimestamp * 1000),
                    duplicatesSkipped: duplicates
                };

            } catch (error) {
                retries++;
                console.log(`     ⚠️  Attempt ${retries}/${this.maxRetries} failed: ${error.message}`);
                
                if (retries < this.maxRetries) {
                    await this.delay(3000 * retries); // Exponential backoff
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
            
            if (close <= 0 || !timestamp) continue; // Skip invalid data
            
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

        return priceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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
            fee_tier: null,
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
        
        let tokens = [];
        if (tokenPair.includes(' / ')) {
            tokens = tokenPair.split(' / ');
        } else if (tokenPair.includes('/')) {
            tokens = tokenPair.split('/');
        } else if (tokenPair.includes('-')) {
            tokens = tokenPair.split('-');
        } else {
            return null;
        }
        
        return tokens[index]?.trim() || null;
    }

    async showCoverageSummary() {
        console.log('\n📊 Final Coverage Summary:');
        
        const totalStats = await analyticsDB.get(`
            SELECT 
                COUNT(DISTINCT pool_address) as total_pools,
                COUNT(*) as total_data_points,
                MIN(DATE(timestamp)) as oldest_date,
                MAX(DATE(timestamp)) as newest_date
            FROM price_data
        `);

        console.log(`   Total Pools: ${totalStats.total_pools}`);
        console.log(`   Total Data Points: ${totalStats.total_data_points.toLocaleString()}`);
        console.log(`   Overall Date Range: ${totalStats.oldest_date} to ${totalStats.newest_date}`);

        // Show pools with 180+ days coverage
        const sufficientCoverage = await analyticsDB.all(`
            SELECT 
                p.token_pair,
                p.network,
                p.protocol,
                COUNT(pd.id) as data_points,
                JULIANDAY(MAX(pd.timestamp)) - JULIANDAY(MIN(pd.timestamp)) as days_coverage
            FROM pools p
            JOIN price_data pd ON p.pool_address = pd.pool_address
            GROUP BY p.pool_address
            HAVING days_coverage >= 180
            ORDER BY days_coverage DESC
        `);

        console.log(`\n✅ Pools with 180+ days coverage: ${sufficientCoverage.length}`);
        
        if (sufficientCoverage.length > 0) {
            console.log('\n📅 Top pools by coverage:');
            sufficientCoverage.slice(0, 10).forEach((pool, i) => {
                console.log(`   ${i+1}. ${pool.token_pair} (${pool.network}) - ${Math.round(pool.days_coverage)} days`);
            });
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
        else if (key === 'networks') options.networks = value.split(',');
    }
    
    console.log('🚀 CLM Analytics - Comprehensive 180-Day Historical Backfill\n');
    
    if (args.includes('--help')) {
        console.log('Usage: node comprehensive-backfill.js [options]');
        console.log('Options:');
        console.log('  --days 180        Number of days to collect (default: 180)');
        console.log('  --networks eth,arbitrum    Networks to target (default: eth,arbitrum,base,polygon)');
        console.log('\nExample:');
        console.log('  node comprehensive-backfill.js --days 180 --networks eth,arbitrum,base');
        return;
    }
    
    const backfill = new ComprehensiveBackfill();
    await backfill.run(options);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = ComprehensiveBackfill;