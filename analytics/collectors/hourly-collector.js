#!/usr/bin/env node
// Hourly data collector for CLM Analytics
// Collects latest price data and updates analytics for tiered pools

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { geckoTerminalClient, defiLlamaClient } = require('../utils/api-client');
const { 
    calculateRollingVolatility, 
    calculateFVR, 
    classifyFVR,
    calculatePoolFeeAPR,
    calculateExpectedILRate,
    calculateBreakevenFeeAPR,
    validateDataQuality 
} = require('../utils/math-helpers');

// Make database globally available for API clients
global.analyticsDB = analyticsDB;

class HourlyCollector {
    constructor() {
        this.maxRetries = 3;
        this.delayBetweenPools = 2000; // 2 seconds between pools
    }

    async run() {
        console.log('🔄 Hourly Collection Starting...', new Date().toISOString());

        try {
            await analyticsDB.initialize();

            // Step 1: Get pools by priority tier
            const tiers = await this.getPoolTiers();
            console.log(`📊 Processing ${tiers.tier1.length} Tier 1, ${tiers.tier2.length} Tier 2, ${tiers.tier3.length} Tier 3 pools`);

            // Step 2: Process each tier
            await this.processTier('Tier 1 (Active Positions)', tiers.tier1, true);
            await this.processTier('Tier 2 (Watchlist)', tiers.tier2, true);
            await this.processTier('Tier 3 (Top Pools)', tiers.tier3, false); // Less frequent updates

            // Step 3: Update analytics for all pools with recent data
            console.log('\n📊 Updating analytics calculations...');
            await this.updateAnalytics();

            console.log('\n✅ Hourly collection completed successfully');

        } catch (error) {
            console.error('❌ Hourly collection failed:', error);
            process.exit(1);
        } finally {
            await analyticsDB.close();
        }
    }

    async getPoolTiers() {
        // Tier 1: Active user positions (highest priority - hourly updates)
        const tier1 = await analyticsDB.all(`
            SELECT DISTINCT up.pool_address, up.network, p.token_pair, p.protocol
            FROM user_positions up
            JOIN pools p ON up.pool_address = p.pool_address
            WHERE up.position_type = 'active'
        `);

        // Tier 2: Watchlist pools (medium priority - every 6 hours)
        const currentHour = new Date().getHours();
        const shouldUpdateTier2 = currentHour % 6 === 0; // Update every 6 hours

        let tier2 = [];
        if (shouldUpdateTier2) {
            tier2 = await analyticsDB.all(`
                SELECT DISTINCT up.pool_address, up.network, p.token_pair, p.protocol
                FROM user_positions up
                JOIN pools p ON up.pool_address = p.pool_address
                WHERE up.position_type = 'watchlist'
            `);
        }

        // Tier 3: Top pools by TVL (lowest priority - daily updates)
        const shouldUpdateTier3 = currentHour === 6; // Update daily at 6 AM

        let tier3 = [];
        if (shouldUpdateTier3) {
            // Get top pools that aren't already in tier 1 or 2
            const existingPools = [...tier1, ...tier2].map(p => p.pool_address);
            
            tier3 = await analyticsDB.all(`
                SELECT pa.pool_address, pa.network, pa.token_pair, p.protocol
                FROM pool_analytics pa
                JOIN pools p ON pa.pool_address = p.pool_address
                WHERE pa.tvl_usd >= 1000000
                AND pa.pool_address NOT IN (${existingPools.map(() => '?').join(',') || 'NULL'})
                ORDER BY pa.tvl_usd DESC
                LIMIT 50
            `, existingPools);
        }

        return { tier1, tier2, tier3 };
    }

    async processTier(tierName, pools, collectData = true) {
        if (pools.length === 0) {
            console.log(`\n⏭️  ${tierName}: No pools to process`);
            return;
        }

        console.log(`\n🔄 ${tierName}: Processing ${pools.length} pools`);

        let successful = 0;
        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i];
            
            try {
                console.log(`  [${i+1}/${pools.length}] ${pool.token_pair} (${pool.protocol})`);

                if (collectData) {
                    const success = await this.collectLatestData(pool);
                    if (success) {
                        successful++;
                        console.log(`    ✅ Data collected`);
                    } else {
                        console.log(`    ⚠️  No new data`);
                    }
                }

                // Add delay between pools
                if (i < pools.length - 1) {
                    await this.delay(this.delayBetweenPools);
                }

            } catch (error) {
                console.log(`    ❌ Error: ${error.message}`);
            }
        }

        console.log(`  📊 ${tierName} Summary: ${successful}/${pools.length} successful`);
    }

    async collectLatestData(pool) {
        let retries = 0;

        while (retries < this.maxRetries) {
            try {
                // Get latest OHLCV data (last 2 hours to ensure we have current data)
                const ohlcvData = await geckoTerminalClient.getOHLCV(
                    pool.network, 
                    pool.pool_address, 
                    'hour', 
                    2 // Last 2 hours
                );

                if (!ohlcvData?.data?.attributes?.ohlcv_list || ohlcvData.data.attributes.ohlcv_list.length === 0) {
                    return false;
                }

                const candles = ohlcvData.data.attributes.ohlcv_list;
                const latestCandle = candles[candles.length - 1]; // Most recent

                const [timestamp, open, high, low, close, volume] = latestCandle;

                if (close <= 0) {
                    console.log(`    ⚠️  Invalid price data: ${close}`);
                    return false;
                }

                // Check if we already have this data point
                const existing = await analyticsDB.get(`
                    SELECT id FROM price_data 
                    WHERE pool_address = ? 
                    AND timestamp = ?
                `, [pool.pool_address, new Date(timestamp * 1000).toISOString()]);

                if (existing) {
                    return false; // Already have this data
                }

                // Get previous price for log return calculation
                const previousData = await analyticsDB.get(`
                    SELECT price FROM price_data
                    WHERE pool_address = ?
                    ORDER BY timestamp DESC
                    LIMIT 1
                `, [pool.pool_address]);

                let logReturn = null;
                if (previousData && previousData.price > 0) {
                    logReturn = Math.log(close / previousData.price);
                }

                // Insert new price data
                await analyticsDB.insertPriceData({
                    timestamp: new Date(timestamp * 1000).toISOString(),
                    pool_address: pool.pool_address,
                    network: pool.network,
                    price: close,
                    volume_usd: volume || 0,
                    log_return: logReturn
                });

                return true;

            } catch (error) {
                retries++;
                
                if (retries < this.maxRetries) {
                    console.log(`    ⚠️  Attempt ${retries}/${this.maxRetries} failed, retrying...`);
                    await this.delay(1000 * retries);
                } else {
                    throw error;
                }
            }
        }
    }

    async updateAnalytics() {
        try {
            // Get all pools that have price data
            const poolsWithData = await analyticsDB.all(`
                SELECT DISTINCT p.pool_address, p.network, p.token_pair, p.protocol
                FROM pools p
                WHERE EXISTS (
                    SELECT 1 FROM price_data pd 
                    WHERE pd.pool_address = p.pool_address
                )
            `);

            console.log(`  📊 Updating analytics for ${poolsWithData.length} pools...`);

            let updated = 0;
            for (const pool of poolsWithData) {
                try {
                    const success = await this.calculatePoolAnalytics(pool);
                    if (success) updated++;
                } catch (error) {
                    console.log(`    ❌ Error calculating analytics for ${pool.token_pair}: ${error.message}`);
                }
            }

            console.log(`  ✅ Updated analytics for ${updated}/${poolsWithData.length} pools`);

        } catch (error) {
            console.error('❌ Error updating analytics:', error);
        }
    }

    async calculatePoolAnalytics(pool) {
        // Get price history for volatility calculation
        const priceHistory = await analyticsDB.all(`
            SELECT timestamp, price, log_return, volume_usd
            FROM price_data
            WHERE pool_address = ?
            AND timestamp >= datetime('now', '-30 days')
            ORDER BY timestamp ASC
        `, [pool.pool_address]);

        if (priceHistory.length < 24) {
            return false; // Need at least 24 hours of data
        }

        // Extract returns for volatility calculation
        const returns = priceHistory
            .filter(row => row.log_return !== null)
            .map(row => row.log_return);

        if (returns.length < 20) {
            return false; // Need sufficient returns
        }

        // Calculate rolling volatility
        const volatilities = calculateRollingVolatility(returns, 'hourly');
        if (!volatilities) {
            return false;
        }

        // Get pool metadata from DeFiLlama (cached approach)
        let poolMetadata = null;
        try {
            const allPools = await defiLlamaClient.getAllPools();
            if (allPools.status === 'success' && allPools.data) {
                poolMetadata = allPools.data.find(p => p.pool === pool.pool_address);
            }
        } catch (error) {
            console.log(`    ⚠️  Could not fetch metadata: ${error.message}`);
        }

        // Calculate metrics
        const tvlUsd = poolMetadata?.tvlUsd || null;
        const fees24h = poolMetadata ? (poolMetadata.tvlUsd * (poolMetadata.apy || 0) / 365) : null;
        const poolFeeAPR = fees24h && tvlUsd ? calculatePoolFeeAPR(fees24h, tvlUsd) : null;
        
        const fvr = poolFeeAPR && volatilities['30d'] ? calculateFVR(poolFeeAPR, volatilities['30d']) : null;
        const recommendation = fvr ? classifyFVR(fvr) : null;
        
        const expectedIL = volatilities['30d'] ? calculateExpectedILRate(volatilities['30d']) : null;
        const breakevenAPR = expectedIL ? calculateBreakevenFeeAPR(expectedIL) : null;

        // IL risk score (1-10 scale)
        let ilRiskScore = null;
        if (fvr) {
            if (fvr > 1.0) ilRiskScore = Math.min(3, Math.round(1 + (1/fvr) * 2)); // Low risk
            else if (fvr > 0.6) ilRiskScore = Math.round(4 + (1-fvr) * 6); // Medium risk  
            else ilRiskScore = Math.max(8, Math.round(8 + (0.6-fvr) * 5)); // High risk
        }

        // Data quality metrics
        const oldestData = priceHistory[0]?.timestamp;
        const newestData = priceHistory[priceHistory.length - 1]?.timestamp;

        // Save analytics
        const analytics = {
            pool_address: pool.pool_address,
            network: pool.network,
            token_pair: pool.token_pair,
            tvl_usd: tvlUsd,
            volume_24h: poolMetadata?.volumeUsd1d || null,
            fees_24h: fees24h,
            apy_base: poolMetadata?.apyBase || null,
            apy_reward: poolMetadata?.apyReward || null,
            volatility_1d: volatilities['1d'] || null,
            volatility_7d: volatilities['7d'] || null,
            volatility_30d: volatilities['30d'] || null,
            fvr: fvr,
            il_risk_score: ilRiskScore,
            recommendation: recommendation,
            expected_il_30d: expectedIL,
            breakeven_fee_apr: breakevenAPR,
            data_points_count: priceHistory.length,
            oldest_data_timestamp: oldestData,
            newest_data_timestamp: newestData
        };

        await analyticsDB.updatePoolAnalytics(analytics);

        // Store historical snapshots for trending
        if (fvr) {
            await this.storeFVRSnapshot(pool.pool_address, fvr, poolFeeAPR, volatilities['30d'], recommendation);
        }
        
        if (volatilities['30d']) {
            await this.storeVolatilitySnapshot(pool.pool_address, volatilities['30d']);
        }

        return true;
    }

    async storeFVRSnapshot(poolAddress, fvr, feeAPR, volatility, recommendation) {
        const today = new Date().toISOString().split('T')[0];
        
        try {
            await analyticsDB.run(`
                INSERT OR REPLACE INTO fvr_history 
                (pool_address, date, fvr_value, fee_apr, volatility, recommendation)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [poolAddress, today, fvr, feeAPR, volatility, recommendation]);
        } catch (error) {
            console.log(`    ⚠️  Error storing FVR snapshot: ${error.message}`);
        }
    }

    async storeVolatilitySnapshot(poolAddress, volatility) {
        const today = new Date().toISOString().split('T')[0];
        
        try {
            await analyticsDB.run(`
                INSERT OR REPLACE INTO volatility_history 
                (pool_address, date, volatility_value, period_days)
                VALUES (?, ?, ?, 30)
            `, [poolAddress, today, volatility]);
        } catch (error) {
            console.log(`    ⚠️  Error storing volatility snapshot: ${error.message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Command line interface
async function main() {
    const collector = new HourlyCollector();
    await collector.run();
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Hourly collector failed:', error);
        process.exit(1);
    });
}

module.exports = HourlyCollector;