#!/usr/bin/env node
// Calculate and populate key metrics for all pools
// Includes volatility, FVR, IL risk, and recommendations based on math.md formulas

require('dotenv').config();
const analyticsDB = require('../utils/database');
const { validateDataQuality } = require('../utils/math-helpers');

global.analyticsDB = analyticsDB;

class PoolMetricsCalculator {
    constructor() {
        this.processed = 0;
        this.successful = 0;
        
        // FVR thresholds from math.md Section 7
        this.FVR_THRESHOLDS = {
            ATTRACTIVE: 1.0,     // >1.0 = attractive
            FAIR: 0.6,          // 0.6-1.0 = fair 
            OVERPRICED: 0.6     // <0.6 = overpriced
        };
    }

    async run() {
        console.log('📊 Calculating Pool Metrics for CLM Analytics');
        console.log('🔢 Using math.md formulas for FVR, volatility, and IL calculations\n');

        try {
            await analyticsDB.initialize();

            // Get all pools with historical data
            console.log('🎯 Step 1: Identifying pools with historical data...');
            const pools = await this.getPoolsWithData();
            console.log(`✅ Found ${pools.length} pools with historical data\n`);

            // Calculate metrics for each pool
            console.log('📈 Step 2: Calculating metrics for each pool...');
            
            for (const pool of pools) {
                this.processed++;
                await this.calculatePoolMetrics(pool);
            }

            // Summary
            console.log(`\n📊 POOL METRICS CALCULATION RESULTS:`);
            console.log(`   Pools processed: ${this.processed}`);
            console.log(`   Successful calculations: ${this.successful}`);
            console.log(`   Success rate: ${((this.successful/this.processed)*100).toFixed(1)}%`);

            console.log(`\n🎉 Pool analytics ready! Use monitor-progress.js to view results.`);

        } catch (error) {
            console.error('❌ Pool metrics calculation failed:', error);
        } finally {
            await analyticsDB.close();
        }
    }

    async getPoolsWithData() {
        return await analyticsDB.all(`
            SELECT 
                p.pool_address,
                p.network,
                p.token_pair,
                p.protocol,
                COUNT(pd.id) as data_points,
                MIN(pd.timestamp) as oldest_data,
                MAX(pd.timestamp) as newest_data,
                pd.price as current_price,
                AVG(pd.volume_usd) as avg_volume
            FROM pools p
            LEFT JOIN price_data pd ON p.pool_address = pd.pool_address
            WHERE pd.id IS NOT NULL
            GROUP BY p.pool_address
            HAVING COUNT(pd.id) >= 7  -- Minimum 7 data points for calculations
            ORDER BY data_points DESC
        `);
    }

    async calculatePoolMetrics(pool) {
        console.log(`\n[${this.processed}] ${pool.token_pair} (${pool.network})`);
        console.log(`   Pool: ${pool.pool_address}`);
        console.log(`   Data points: ${pool.data_points}`);

        try {
            // Get price data for calculations
            const priceData = await this.getPriceData(pool.pool_address);
            
            if (!priceData || priceData.length < 7) {
                console.log(`   ❌ Insufficient data (${priceData?.length || 0} points)`);
                return;
            }

            // Calculate volatility metrics (math.md Section 3)
            const volatility = await this.calculateVolatility(priceData);
            
            // Calculate current metrics from latest data
            const currentMetrics = await this.getCurrentMetrics(pool.pool_address);
            
            // Calculate FVR and recommendation (math.md Section 7)
            const fvrMetrics = this.calculateFVR(currentMetrics, volatility);
            
            // Calculate IL risk and breakeven (math.md Section 4)
            const ilMetrics = this.calculateILRisk(volatility, currentMetrics);

            // Store metrics in pool_analytics table
            await this.storePoolMetrics({
                pool_address: pool.pool_address,
                network: pool.network,
                token_pair: pool.token_pair,
                ...currentMetrics,
                ...volatility,
                ...fvrMetrics,
                ...ilMetrics,
                data_points_count: pool.data_points,
                oldest_data_timestamp: pool.oldest_data,
                newest_data_timestamp: pool.newest_data
            });

            this.successful++;
            
            console.log(`   ✅ SUCCESS - FVR: ${fvrMetrics.fvr?.toFixed(2) || 'N/A'} | Signal: ${fvrMetrics.recommendation}`);
            console.log(`   📊 Vol30d: ${(volatility.volatility_30d * 100)?.toFixed(1) || 'N/A'}% | IL Risk: ${ilMetrics.il_risk_score}/10`);

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async getPriceData(poolAddress) {
        return await analyticsDB.all(`
            SELECT timestamp, price, volume_usd, log_return
            FROM price_data
            WHERE pool_address = ?
            ORDER BY timestamp ASC
        `, [poolAddress]);
    }

    async calculateVolatility(priceData) {
        if (priceData.length < 2) return { volatility_1d: null, volatility_7d: null, volatility_30d: null };

        // Calculate log returns if not present
        const logReturns = [];
        for (let i = 1; i < priceData.length; i++) {
            const logReturn = priceData[i].log_return || Math.log(priceData[i].price / priceData[i-1].price);
            logReturns.push(logReturn);
        }

        // Calculate volatility for different periods
        const volatility_1d = this.calculateVolatilityForPeriod(logReturns, 1);
        const volatility_7d = this.calculateVolatilityForPeriod(logReturns, 7);
        const volatility_30d = this.calculateVolatilityForPeriod(logReturns, 30);

        return {
            volatility_1d,
            volatility_7d,
            volatility_30d
        };
    }

    calculateVolatilityForPeriod(logReturns, days) {
        if (logReturns.length < days) return null;

        // Take last N days of returns
        const periodReturns = logReturns.slice(-days);
        
        // Calculate standard deviation
        const mean = periodReturns.reduce((sum, r) => sum + r, 0) / periodReturns.length;
        const variance = periodReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / periodReturns.length;
        const volatility = Math.sqrt(variance);

        // Annualize volatility (math.md assumes daily data)
        return volatility * Math.sqrt(365);
    }

    async getCurrentMetrics(poolAddress) {
        // Get latest price data point
        const latest = await analyticsDB.get(`
            SELECT price, volume_usd, timestamp
            FROM price_data
            WHERE pool_address = ?
            ORDER BY timestamp DESC
            LIMIT 1
        `, [poolAddress]);

        if (!latest) return {};

        // Estimate TVL and fees from volume (rough approximations)
        const volume_24h = latest.volume_usd || 0;
        const estimated_tvl = volume_24h * 50; // Rough estimate: 50x daily volume
        const estimated_fees_24h = volume_24h * 0.003; // Assume 0.3% average fee
        
        // Estimate APY from fees (very rough)
        const apy_base = estimated_tvl > 0 ? (estimated_fees_24h * 365) / estimated_tvl : 0;

        return {
            tvl_usd: estimated_tvl,
            volume_24h: volume_24h,
            fees_24h: estimated_fees_24h,
            apy_base: apy_base,
            apy_reward: 0 // No reward APY data available
        };
    }

    calculateFVR(currentMetrics, volatility) {
        const feeAPR = currentMetrics.apy_base || 0;
        const vol30d = volatility.volatility_30d;

        if (!vol30d || vol30d <= 0 || feeAPR <= 0) {
            return { fvr: null, recommendation: 'insufficient_data' };
        }

        // FVR calculation from math.md Section 7
        const fvr = feeAPR / vol30d;

        // Recommendation based on math.md thresholds
        let recommendation;
        if (fvr >= this.FVR_THRESHOLDS.ATTRACTIVE) {
            recommendation = 'attractive';
        } else if (fvr >= this.FVR_THRESHOLDS.FAIR) {
            recommendation = 'fair';
        } else {
            recommendation = 'overpriced';
        }

        return { fvr, recommendation };
    }

    calculateILRisk(volatility, currentMetrics) {
        const vol30d = volatility.volatility_30d || 0;
        
        // IL risk score (1-10 scale) based on 30-day volatility
        let il_risk_score;
        if (vol30d < 0.2) il_risk_score = 1;        // <20% vol = very low risk
        else if (vol30d < 0.4) il_risk_score = 3;  // 20-40% = low risk  
        else if (vol30d < 0.6) il_risk_score = 5;  // 40-60% = medium risk
        else if (vol30d < 0.8) il_risk_score = 7;  // 60-80% = high risk
        else if (vol30d < 1.0) il_risk_score = 9;  // 80-100% = very high risk
        else il_risk_score = 10;                   // >100% = extreme risk

        // Expected IL for 30 days (simplified approximation from math.md)
        // IL ≈ (σ²/8) for small price movements
        const expected_il_30d = vol30d > 0 ? Math.pow(vol30d, 2) / 8 : 0;

        // Breakeven fee APR (fee needed to compensate for IL)
        const breakeven_fee_apr = currentMetrics.apy_base > 0 ? 
            currentMetrics.apy_base + expected_il_30d * 12 : // Annualize 30-day IL
            expected_il_30d * 12;

        return {
            il_risk_score,
            expected_il_30d,
            breakeven_fee_apr
        };
    }

    async storePoolMetrics(metrics) {
        const sql = `
            INSERT OR REPLACE INTO pool_analytics (
                pool_address, network, token_pair, tvl_usd, volume_24h, fees_24h,
                apy_base, apy_reward, volatility_1d, volatility_7d, volatility_30d,
                fvr, il_risk_score, recommendation, expected_il_30d, breakeven_fee_apr,
                data_points_count, oldest_data_timestamp, newest_data_timestamp, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        await analyticsDB.run(sql, [
            metrics.pool_address, metrics.network, metrics.token_pair,
            metrics.tvl_usd, metrics.volume_24h, metrics.fees_24h,
            metrics.apy_base, metrics.apy_reward,
            metrics.volatility_1d, metrics.volatility_7d, metrics.volatility_30d,
            metrics.fvr, metrics.il_risk_score, metrics.recommendation,
            metrics.expected_il_30d, metrics.breakeven_fee_apr,
            metrics.data_points_count, metrics.oldest_data_timestamp, metrics.newest_data_timestamp
        ]);
    }
}

// Command line interface
async function main() {
    const calculator = new PoolMetricsCalculator();
    await calculator.run();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = PoolMetricsCalculator;