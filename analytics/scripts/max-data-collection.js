#!/usr/bin/env node
// Maximum data collection within GeckoTerminal API constraints
// Targets 42-45 days of historical data (the maximum available) for high-yield pools

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { geckoTerminalClient } = require('../utils/api-client');
const { validateDataQuality } = require('../utils/math-helpers');

global.analyticsDB = analyticsDB;

class MaxDataCollection {
    constructor() {
        this.delayBetweenPools = 6000; // 6 second delay
        this.maxRetries = 2;
        this.maxDaysAvailable = 45; // Realistic maximum from GeckoTerminal
        
        // Expanded list of high-yield pool addresses across multiple networks
        this.targetPools = [
            // Ethereum - High volume pools likely to appear in top 100
            { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', network: 'eth', name: 'USDC-WETH 0.05%', protocol: 'uniswap_v3' },
            { address: '0x11b815efb8f581194ae79006d24e0d814b7697f6', network: 'eth', name: 'WETH-USDT 0.05%', protocol: 'uniswap_v3' },
            { address: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', network: 'eth', name: 'WETH-USDT 0.3%', protocol: 'uniswap_v3' },
            { address: '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852', network: 'eth', name: 'WETH-USDT', protocol: 'uniswap_v2' },
            { address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc', network: 'eth', name: 'USDC-WETH', protocol: 'uniswap_v2' },
            { address: '0xa374094527e1673a86de625aa59517c5de346d32', network: 'eth', name: 'CRO-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3', network: 'eth', name: 'MKR-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x60594a405d53811d3bc4766596efd80fd545a270', network: 'eth', name: 'WETH-DAI 0.3%', protocol: 'uniswap_v3' },
            { address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', network: 'eth', name: 'USDC-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x6c6bc977e13df9b0de53b251522280bb72383700', network: 'eth', name: 'DAI-USDC 0.05%', protocol: 'uniswap_v3' },
            { address: '0x7bea39867e4169dbe237d55c8242a8f2fcdcc387', network: 'eth', name: 'USDC-WETH 1%', protocol: 'uniswap_v3' },
            { address: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11', network: 'eth', name: 'DAI-WETH', protocol: 'uniswap_v2' },
            { address: '0x43ae24960e5534731fc831386c07755a2dc33d47', network: 'eth', name: 'SNX-WETH', protocol: 'uniswap_v2' },
            { address: '0xd3d2e2692501a5c9ca623199d38826e513033a17', network: 'eth', name: 'UNI-WETH', protocol: 'uniswap_v2' },
            
            // High-yield volatile pairs from existing data
            { address: '0x109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa', network: 'eth', name: 'wstETH-WETH 0.01%', protocol: 'uniswap_v3' },
            { address: '0x08a5a1e2671839dadc25e2e20f9206fd33c88092', network: 'eth', name: 'BIO-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x1e1dfff79d95725aaafd6b47af4fbc28d859ce28', network: 'eth', name: 'USD1-USDC 0.01%', protocol: 'uniswap_v3' },
            { address: '0x185a1ff695d30a22c19f44c6b41e2d6d1c8c1f11', network: 'eth', name: 'USD1-USDT 0.01%', protocol: 'uniswap_v3' },
            { address: '0x003896387666c5c11458eeb3f927b72a11b19783', network: 'eth', name: 'DOLO-USDC 0.3%', protocol: 'uniswap_v3' },
            
            // Arbitrum pools
            { address: '0xc6962004f452be9203591991d15f6b388e09e8d0', network: 'arbitrum', name: 'USDC-WETH 0.05%', protocol: 'uniswap_v3' },
            { address: '0x641c00a822e8b671738d32a431a4fb6074e5c79d', network: 'arbitrum', name: 'WETH-USDT 0.05%', protocol: 'uniswap_v3' },
            { address: '0x17c14d2c404d167802b16c450d3c99f88f2c4f4d', network: 'arbitrum', name: 'WETH-USDC 0.3%', protocol: 'uniswap_v3' },
            { address: '0x80a9ae39310abf666a87c743d6ebbd0e8c42158e', network: 'arbitrum', name: 'WETH-USDT 0.3%', protocol: 'uniswap_v3' },
            
            // Base pools (Aerodrome and Uniswap V3)
            { address: '0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59', network: 'base', name: 'WETH-USDC 0.05%', protocol: 'aerodrome-slipstream' },
            { address: '0xd0b53d9277642d899df5c87a3966a349a798f224', network: 'base', name: 'WETH-USDC 0.05%', protocol: 'uniswap_v3' },
            { address: '0x4c36388be6f416a29c8d8eee81c771ce6be14b18', network: 'base', name: 'WETH-USDC 0.3%', protocol: 'uniswap_v3' },
            
            // Polygon pools
            { address: '0x45dda9cb7c25131df268515131f647d726f50608', network: 'polygon', name: 'USDC-WETH 0.05%', protocol: 'uniswap_v3' },
            { address: '0x86f1d8390222a3691c28938ec7404a1661e618e0', network: 'polygon', name: 'WMATIC-USDC 0.3%', protocol: 'uniswap_v3' },
        ];
    }

    async run() {
        console.log('📊 Maximum Data Collection - Working within API Constraints');
        console.log(`🎯 Target: Maximum available data (${this.maxDaysAvailable} days) for ${this.targetPools.length} high-yield pools\n`);

        try {
            await analyticsDB.initialize();

            let processed = 0;
            let successful = 0;
            let totalDataPoints = 0;
            let poolsWith30PlusDays = 0;

            for (const pool of this.targetPools) {
                processed++;
                
                console.log(`\n[${processed}/${this.targetPools.length}] ${pool.name}`);
                console.log(`   Network: ${pool.network} | Protocol: ${pool.protocol}`);

                try {
                    const result = await this.collectMaximumData(pool);
                    
                    if (result && result.success) {
                        successful++;
                        totalDataPoints += result.dataPoints;
                        
                        const daysCovered = result.daysCovered || 0;
                        
                        if (daysCovered >= 30) {
                            poolsWith30PlusDays++;
                            console.log(`   ✅ SUCCESS - ${result.dataPoints} points (${Math.round(daysCovered)} days coverage)`);
                        } else {
                            console.log(`   ⚠️  PARTIAL - ${result.dataPoints} points (${Math.round(daysCovered)} days coverage)`);
                        }
                        
                    } else {
                        console.log(`   ❌ Failed - ${result?.error || 'no data available'}`);
                    }

                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }

                // Rate limiting delay
                if (processed < this.targetPools.length) {
                    console.log(`   ⏳ Waiting ${this.delayBetweenPools/1000}s...`);
                    await this.delay(this.delayBetweenPools);
                }
            }

            // Final comprehensive summary
            console.log(`\n\n🎯 MAXIMUM DATA COLLECTION RESULTS:`);
            console.log(`═══════════════════════════════════════════════════════`);
            console.log(`   Pools processed: ${processed}`);
            console.log(`   Successful collections: ${successful}`);
            console.log(`   Pools with 30+ days data: ${poolsWith30PlusDays}`);
            console.log(`   Total data points collected: ${totalDataPoints.toLocaleString()}`);
            console.log(`   Overall success rate: ${((successful/processed)*100).toFixed(1)}%`);

            // Check final database status
            await this.showFinalDatabaseStatus();

            if (poolsWith30PlusDays >= 50) {
                console.log(`\n🎉 EXCELLENT: ${poolsWith30PlusDays} pools have 30+ days of data for reliable volatility analysis!`);
            } else if (poolsWith30PlusDays >= 25) {
                console.log(`\n✅ GOOD: ${poolsWith30PlusDays} pools have sufficient data for analysis.`);
            } else {
                console.log(`\n⚠️  LIMITED: Only ${poolsWith30PlusDays} pools have sufficient data. Consider alternative data sources.`);
            }

        } catch (error) {
            console.error('❌ Maximum data collection failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async collectMaximumData(pool) {
        try {
            // Step 1: Check if we already have sufficient data
            const existing = await analyticsDB.get(`
                SELECT 
                    COUNT(*) as data_points,
                    JULIANDAY(MAX(timestamp)) - JULIANDAY(MIN(timestamp)) as days_covered
                FROM price_data
                WHERE pool_address = ?
            `, [pool.address]);

            if (existing && existing.days_covered >= 30 && existing.data_points >= 720) {
                return {
                    success: true,
                    dataPoints: existing.data_points,
                    daysCovered: existing.days_covered,
                    status: 'sufficient_existing_data'
                };
            }

            // Step 2: Save pool metadata
            await this.savePoolMetadata(pool);

            // Step 3: Try to collect maximum available data (start with 45 days, fallback to shorter periods)
            console.log(`     📥 Fetching maximum available historical data...`);
            
            let ohlcvData = null;
            let targetDays = this.maxDaysAvailable;
            
            // Try decreasing time periods until we get data
            while (!ohlcvData && targetDays >= 7) {
                try {
                    ohlcvData = await geckoTerminalClient.getHistoricalOHLCV(
                        pool.network,
                        pool.address,
                        targetDays
                    );
                    
                    if (ohlcvData && ohlcvData.length > 0) {
                        break; // Success
                    }
                } catch (error) {
                    console.log(`     ⚠️  ${targetDays} days failed, trying shorter period...`);
                }
                
                targetDays = Math.floor(targetDays * 0.7); // Reduce by 30%
            }

            if (!ohlcvData || ohlcvData.length === 0) {
                return { success: false, error: 'No historical data available' };
            }

            // Step 4: Process and validate
            console.log(`     🔄 Processing ${ohlcvData.length} data points from ${targetDays} day request...`);
            
            const priceData = this.processOHLCVData(ohlcvData, pool);
            
            if (priceData.length === 0) {
                return { success: false, error: 'No valid price data after processing' };
            }

            const validation = validateDataQuality(priceData.map(p => p.price), 'prices');
            if (!validation.valid) {
                return { success: false, error: `Data quality issue: ${validation.error}` };
            }

            // Step 5: Store in database with duplicate handling
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

            // Calculate actual coverage
            const timestamps = ohlcvData.map(d => d[0]);
            const oldestTimestamp = Math.min(...timestamps);
            const newestTimestamp = Math.max(...timestamps);
            const daysCovered = (newestTimestamp - oldestTimestamp) / (24 * 60 * 60);

            return {
                success: true,
                dataPoints: storedCount,
                daysCovered: daysCovered,
                duplicatesSkipped: duplicatesSkipped,
                totalProcessed: priceData.length,
                targetDays: targetDays
            };

        } catch (error) {
            console.log(`     ⚠️  Collection error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    processOHLCVData(ohlcvData, pool) {
        const priceData = [];
        let previousClose = null;

        for (const candle of ohlcvData) {
            const [timestamp, open, high, low, close, volume] = candle;
            
            if (close <= 0 || !timestamp) continue;
            
            let logReturn = null;
            if (previousClose !== null && previousClose > 0) {
                logReturn = Math.log(close / previousClose);
            }

            priceData.push({
                timestamp: new Date(timestamp * 1000).toISOString(),
                pool_address: pool.address,
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
            pool_address: pool.address,
            network: pool.network,
            token_pair: pool.name,
            token0_address: null,
            token1_address: null,
            token0_symbol: null,
            token1_symbol: null,
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

    async showFinalDatabaseStatus() {
        console.log('\n📊 Final Database Status:');
        
        const totalStats = await analyticsDB.get(`
            SELECT 
                COUNT(DISTINCT pool_address) as total_pools,
                COUNT(*) as total_data_points,
                MIN(DATE(timestamp)) as oldest_date,
                MAX(DATE(timestamp)) as newest_date
            FROM price_data
        `);

        console.log(`   Total Pools in Database: ${totalStats.total_pools}`);
        console.log(`   Total Data Points: ${totalStats.total_data_points.toLocaleString()}`);
        console.log(`   Date Range: ${totalStats.oldest_date} to ${totalStats.newest_date}`);

        // Show coverage distribution
        const coverageStats = await analyticsDB.all(`
            SELECT 
                CASE 
                    WHEN days_covered >= 30 THEN '30+ days'
                    WHEN days_covered >= 14 THEN '14-29 days'
                    WHEN days_covered >= 7 THEN '7-13 days'
                    ELSE '<7 days'
                END as coverage_bucket,
                COUNT(*) as pool_count
            FROM (
                SELECT 
                    pool_address,
                    JULIANDAY(MAX(timestamp)) - JULIANDAY(MIN(timestamp)) as days_covered
                FROM price_data
                GROUP BY pool_address
            )
            GROUP BY coverage_bucket
            ORDER BY 
                CASE coverage_bucket
                    WHEN '30+ days' THEN 1
                    WHEN '14-29 days' THEN 2
                    WHEN '7-13 days' THEN 3
                    ELSE 4
                END
        `);

        console.log('\n📅 Data Coverage Distribution:');
        for (const stat of coverageStats) {
            console.log(`   ${stat.coverage_bucket}: ${stat.pool_count} pools`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the maximum data collection
async function main() {
    const collector = new MaxDataCollection();
    await collector.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MaxDataCollection;