#!/usr/bin/env node
// Target specific high-yield pool addresses with 180+ days historical data
// Based on the top 100 yield pools list provided

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { geckoTerminalClient } = require('../utils/api-client');
const { validateDataQuality } = require('../utils/math-helpers');

global.analyticsDB = analyticsDB;

class TargetYieldPools {
    constructor() {
        this.delayBetweenPools = 8000; // 8 second delay to avoid rate limiting
        this.maxRetries = 3;
        this.targetDays = 180;
        
        // Known high-yield pool addresses from Ethereum network
        // These are common pool addresses from major protocols
        this.knownHighYieldPools = [
            // Uniswap V3 ETH pools (high volume/yield)
            { address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', network: 'eth', name: 'USDC-WETH 0.05%', protocol: 'uniswap_v3' },
            { address: '0x11b815efb8f581194ae79006d24e0d814b7697f6', network: 'eth', name: 'WETH-USDT 0.05%', protocol: 'uniswap_v3' },
            { address: '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36', network: 'eth', name: 'WETH-USDT 0.3%', protocol: 'uniswap_v3' },
            { address: '0xa374094527e1673a86de625aa59517c5de346d32', network: 'eth', name: 'CRO-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3', network: 'eth', name: 'MKR-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x60594a405d53811d3bc4766596efd80fd545a270', network: 'eth', name: 'WETH-DAI 0.3%', protocol: 'uniswap_v3' },
            
            // High-yield smaller cap pools
            { address: '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852', network: 'eth', name: 'WETH-USDT', protocol: 'uniswap_v2' },
            { address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc', network: 'eth', name: 'USDC-WETH', protocol: 'uniswap_v2' },
            { address: '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11', network: 'eth', name: 'DAI-WETH', protocol: 'uniswap_v2' },
            
            // Known volatile/high-yield pairs
            { address: '0x43ae24960e5534731fc831386c07755a2dc33d47', network: 'eth', name: 'SNX-WETH', protocol: 'uniswap_v2' },
            { address: '0xd3d2e2692501a5c9ca623199d38826e513033a17', network: 'eth', name: 'UNI-WETH', protocol: 'uniswap_v2' },
            
            // Additional Uniswap V3 pools
            { address: '0x7bea39867e4169dbe237d55c8242a8f2fcdcc387', network: 'eth', name: 'USDC-WETH 1%', protocol: 'uniswap_v3' },
            { address: '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8', network: 'eth', name: 'USDC-WETH 0.3%', protocol: 'uniswap_v3' },
            { address: '0x6c6bc977e13df9b0de53b251522280bb72383700', network: 'eth', name: 'DAI-USDC 0.05%', protocol: 'uniswap_v3' },
            
            // Arbitrum pools
            { address: '0xc31e54c7a869b9fcbecc14363cf510d1c41fa443', network: 'arbitrum', name: 'WETH-USDC 0.05%', protocol: 'uniswap_v3' },
            { address: '0x641c00a822e8b671738d32a431a4fb6074e5c79d', network: 'arbitrum', name: 'WETH-USDT 0.05%', protocol: 'uniswap_v3' },
            
            // Base pools (if available)
            { address: '0xd0b53d9277642d899df5c87a3966a349a798f224', network: 'base', name: 'WETH-USDC 0.05%', protocol: 'uniswap_v3' },
        ];
    }

    async run() {
        console.log('🎯 Targeting High-Yield Pools for 180-Day Historical Data Collection...\n');

        try {
            await analyticsDB.initialize();

            console.log(`📊 Processing ${this.knownHighYieldPools.length} known high-yield pools`);
            console.log(`⏱️  Using ${this.delayBetweenPools/1000}s delay between pools to respect rate limits\n`);

            let processed = 0;
            let successful = 0;
            let totalDataPoints = 0;

            for (const pool of this.knownHighYieldPools) {
                processed++;
                
                console.log(`\n[${processed}/${this.knownHighYieldPools.length}] ${pool.name}`);
                console.log(`   Network: ${pool.network} | Protocol: ${pool.protocol}`);
                console.log(`   Address: ${pool.address}`);

                try {
                    const result = await this.collectPoolData(pool);
                    
                    if (result && result.success) {
                        successful++;
                        totalDataPoints += result.dataPoints;
                        
                        const daysCovered = result.daysCovered || 0;
                        const status = daysCovered >= 180 ? '✅ SUFFICIENT' : '⚠️  PARTIAL';
                        
                        console.log(`   ${status} - ${result.dataPoints} data points (${Math.round(daysCovered)} days)`);
                        
                        if (daysCovered >= 180) {
                            console.log(`   🎉 Target achieved: 180+ days of historical data!`);
                        }
                    } else {
                        console.log(`   ❌ Failed - ${result?.error || 'insufficient data'}`);
                    }

                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }

                // Rate limiting delay
                if (processed < this.knownHighYieldPools.length) {
                    console.log(`   ⏳ Rate limit delay: ${this.delayBetweenPools/1000}s...`);
                    await this.delay(this.delayBetweenPools);
                }
            }

            // Final summary
            console.log(`\n\n📊 FINAL RESULTS:`);
            console.log(`   Pools processed: ${processed}`);
            console.log(`   Successful collections: ${successful}`);
            console.log(`   Total data points collected: ${totalDataPoints.toLocaleString()}`);
            console.log(`   Success rate: ${((successful/processed)*100).toFixed(1)}%`);

            // Check pools with 180+ days
            const poolsWith180Days = await this.checkFinalCoverage();
            console.log(`   Pools with 180+ days: ${poolsWith180Days}`);

            if (poolsWith180Days > 0) {
                console.log(`\n🎯 SUCCESS: ${poolsWith180Days} pools now have sufficient historical data for analysis!`);
            }

        } catch (error) {
            console.error('❌ Target yield pools collection failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async collectPoolData(pool) {
        try {
            // Step 1: Check existing coverage
            const existing = await analyticsDB.get(`
                SELECT 
                    COUNT(*) as data_points,
                    MIN(DATE(timestamp)) as oldest_date,
                    MAX(DATE(timestamp)) as newest_date,
                    JULIANDAY(MAX(timestamp)) - JULIANDAY(MIN(timestamp)) as days_covered
                FROM price_data
                WHERE pool_address = ?
            `, [pool.address]);

            if (existing && existing.days_covered >= this.targetDays) {
                return {
                    success: true,
                    dataPoints: existing.data_points,
                    daysCovered: existing.days_covered,
                    status: 'already_sufficient'
                };
            }

            // Step 2: Save pool metadata
            await this.savePoolMetadata(pool);

            // Step 3: Collect 180 days of historical data
            console.log(`     📥 Fetching 180 days of hourly OHLCV data...`);
            
            const ohlcvData = await geckoTerminalClient.getHistoricalOHLCV(
                pool.network,
                pool.address,
                this.targetDays
            );

            if (!ohlcvData || ohlcvData.length === 0) {
                return { success: false, error: 'No OHLCV data available' };
            }

            // Step 4: Process and validate
            console.log(`     🔄 Processing ${ohlcvData.length} data points...`);
            
            const priceData = this.processOHLCVData(ohlcvData, pool);
            
            if (priceData.length === 0) {
                return { success: false, error: 'No valid price data after processing' };
            }

            const validation = validateDataQuality(priceData.map(p => p.price), 'prices');
            if (!validation.valid) {
                return { success: false, error: `Data quality issue: ${validation.error}` };
            }

            // Step 5: Store in database
            let storedCount = 0;
            let duplicatesSkipped = 0;

            console.log(`     💾 Storing data points in database...`);
            
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
            const oldestTimestamp = Math.min(...ohlcvData.map(d => d[0]));
            const newestTimestamp = Math.max(...ohlcvData.map(d => d[0]));
            const daysCovered = (newestTimestamp - oldestTimestamp) / (24 * 60 * 60);

            return {
                success: true,
                dataPoints: storedCount,
                daysCovered: daysCovered,
                duplicatesSkipped: duplicatesSkipped,
                totalProcessed: priceData.length
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

    async checkFinalCoverage() {
        const result = await analyticsDB.get(`
            SELECT COUNT(*) as pools_with_180_days
            FROM (
                SELECT pool_address
                FROM price_data
                GROUP BY pool_address
                HAVING JULIANDAY(MAX(timestamp)) - JULIANDAY(MIN(timestamp)) >= 180
            )
        `);
        
        return result?.pools_with_180_days || 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the targeted collection
async function main() {
    const collector = new TargetYieldPools();
    await collector.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TargetYieldPools;